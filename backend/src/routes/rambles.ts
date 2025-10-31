import express from 'express';
import multer from 'multer';
import { prisma } from '../config/database';
import { optionalAuth, authenticate, AuthRequest } from '../middleware/auth';
import { storageService } from '../services/StorageService';
import { transcribeQueue } from '../workers/queue';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors';
import { RambleStatus } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4'];
    if (allowedTypes.some((type) => file.mimetype.includes(type))) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'));
    }
  },
});

/**
 * @route   POST /api/rambles
 * @desc    Create new ramble and upload audio
 * @access  Public (guest or authenticated)
 */
router.post('/', optionalAuth, upload.single('audio'), async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      throw new BadRequestError('Audio file is required');
    }

    const { language, durationSeconds } = req.body;

    // Calculate expiry for guest users
    const expiresAt = req.isGuest
      ? new Date(Date.now() + env.GUEST_RAMBLE_EXPIRY_HOURS * 60 * 60 * 1000)
      : null;

    // Create ramble in database
    const ramble = await prisma.ramble.create({
      data: {
        userId: req.user?.userId || null,
        sessionId: req.sessionId || null,
        status: RambleStatus.uploading,
        language: language || null,
        durationSeconds: durationSeconds ? parseInt(durationSeconds) : null,
        expiresAt,
      },
    });

    // Upload audio to storage
    const { storageKey, storageUrl, checksum } = await storageService.uploadAudio(
      req.file.buffer,
      ramble.id,
      req.file.mimetype
    );

    // Save audio blob reference
    await prisma.audioBlob.create({
      data: {
        rambleId: ramble.id,
        storageUrl,
        storageKey,
        contentType: req.file.mimetype,
        sizeBytes: req.file.size,
        checksum,
      },
    });

    // Enqueue transcription job
    await transcribeQueue.add('transcribe', {
      rambleId: ramble.id,
      storageKey,
      language,
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || null,
        rambleId: ramble.id,
        action: 'created',
        metadata: {
          isGuest: req.isGuest,
          sessionId: req.sessionId,
        },
        ipAddress: req.ip,
      },
    });

    logger.info('Ramble created', {
      rambleId: ramble.id,
      userId: req.user?.userId,
      isGuest: req.isGuest,
      audioSize: req.file.size,
    });

    res.status(201).json({
      status: 'success',
      data: {
        ramble: {
          id: ramble.id,
          status: ramble.status,
          createdAt: ramble.createdAt,
          expiresAt: ramble.expiresAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/rambles
 * @desc    Get user's rambles (paginated)
 * @access  Private or Guest (with sessionId)
 */
router.get('/', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      status: { not: RambleStatus.deleted },
    };

    if (req.user?.userId) {
      where.userId = req.user.userId;
    } else if (req.sessionId) {
      where.sessionId = req.sessionId;
    } else {
      throw new ForbiddenError('No user or session ID');
    }

    // Get rambles
    const [rambles, total] = await Promise.all([
      prisma.ramble.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          durationSeconds: true,
          language: true,
          createdAt: true,
          expiresAt: true,
          transcript: {
            select: {
              rawText: true,
            },
          },
        },
      }),
      prisma.ramble.count({ where }),
    ]);

    // Add excerpt to each ramble
    const ramblesWithExcerpt = rambles.map((ramble) => ({
      ...ramble,
      excerpt: ramble.transcript?.rawText?.substring(0, 150) || null,
      transcript: undefined, // Remove full transcript
    }));

    res.json({
      status: 'success',
      data: {
        rambles: ramblesWithExcerpt,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/rambles/:id
 * @desc    Get single ramble with transcript and polished note
 * @access  Private or Guest (own ramble only)
 */
router.get('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const ramble = await prisma.ramble.findUnique({
      where: { id },
      include: {
        transcript: true,
        polishedNote: true,
        audioBlob: {
          select: {
            contentType: true,
            sizeBytes: true,
          },
        },
      },
    });

    if (!ramble || ramble.status === RambleStatus.deleted) {
      throw new NotFoundError('Ramble not found');
    }

    // Check ownership
    if (req.user?.userId) {
      if (ramble.userId !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (req.sessionId) {
      if (ramble.sessionId !== req.sessionId) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      throw new ForbiddenError('Access denied');
    }

    // Log view event
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || null,
        rambleId: ramble.id,
        action: 'viewed',
        ipAddress: req.ip,
      },
    });

    res.json({
      status: 'success',
      data: { ramble },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/rambles/:id/status
 * @desc    Get ramble processing status
 * @access  Public (for polling)
 */
router.get('/:id/status', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const ramble = await prisma.ramble.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!ramble || ramble.status === RambleStatus.deleted) {
      throw new NotFoundError('Ramble not found');
    }

    // Check ownership (optional auth allows guest polling)
    if (req.user?.userId) {
      const fullRamble = await prisma.ramble.findUnique({ where: { id } });
      if (fullRamble?.userId !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (req.sessionId) {
      const fullRamble = await prisma.ramble.findUnique({ where: { id } });
      if (fullRamble?.sessionId !== req.sessionId) {
        throw new ForbiddenError('Access denied');
      }
    }

    res.json({
      status: 'success',
      data: { ramble },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/rambles/:id
 * @desc    Update ramble (e.g., change title)
 * @access  Private (own ramble only)
 */
router.patch('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
      throw new BadRequestError('Title is required');
    }

    // Find ramble and check ownership
    const existingRamble = await prisma.ramble.findUnique({
      where: { id },
    });

    if (!existingRamble || existingRamble.status === RambleStatus.deleted) {
      throw new NotFoundError('Ramble not found');
    }

    // Check ownership
    if (req.user?.userId) {
      if (existingRamble.userId !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (req.sessionId) {
      if (existingRamble.sessionId !== req.sessionId) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      throw new ForbiddenError('Access denied');
    }

    // Update ramble
    const ramble = await prisma.ramble.update({
      where: { id },
      data: { title: title.substring(0, 500) },
    });

    res.json({
      status: 'success',
      data: { ramble },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/rambles/:id
 * @desc    Delete ramble (and associated audio, transcript, note)
 * @access  Private (own ramble only)
 */
router.delete('/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    // Find ramble with audio blob
    const ramble = await prisma.ramble.findUnique({
      where: { id },
      include: {
        audioBlob: true,
      },
    });

    if (!ramble || ramble.status === RambleStatus.deleted) {
      throw new NotFoundError('Ramble not found');
    }

    // Check ownership
    if (req.user?.userId) {
      if (ramble.userId !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (req.sessionId) {
      if (ramble.sessionId !== req.sessionId) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      throw new ForbiddenError('Access denied');
    }

    // Delete audio from storage
    if (ramble.audioBlob) {
      await storageService.deleteAudio(ramble.audioBlob.storageKey);
    }

    // Soft delete ramble (cascade deletes transcript and note via Prisma)
    await prisma.ramble.update({
      where: { id },
      data: { status: RambleStatus.deleted },
    });

    // Log delete event
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || null,
        rambleId: ramble.id,
        action: 'deleted',
        ipAddress: req.ip,
      },
    });

    logger.info('Ramble deleted', {
      rambleId: ramble.id,
      userId: req.user?.userId,
    });

    res.json({
      status: 'success',
      message: 'Ramble deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/rambles/:id/export
 * @desc    Export transcript as text file
 * @access  Private (own ramble only)
 */
router.get('/:id/export', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const ramble = await prisma.ramble.findUnique({
      where: { id },
      include: {
        transcript: true,
        polishedNote: true,
      },
    });

    if (!ramble || ramble.status === RambleStatus.deleted) {
      throw new NotFoundError('Ramble not found');
    }

    // Check ownership
    if (req.user?.userId) {
      if (ramble.userId !== req.user.userId) {
        throw new ForbiddenError('Access denied');
      }
    } else if (req.sessionId) {
      if (ramble.sessionId !== req.sessionId) {
        throw new ForbiddenError('Access denied');
      }
    } else {
      throw new ForbiddenError('Access denied');
    }

    if (!ramble.transcript) {
      throw new NotFoundError('Transcript not available');
    }

    // Build export content
    const content = `Ramble: ${ramble.title || 'Untitled'}\nCreated: ${ramble.createdAt.toISOString()}\n\n--- Original Transcript ---\n\n${ramble.transcript.rawText}\n\n--- Polished Note ---\n\n${ramble.polishedNote?.content || 'Not available'}`;

    // Log export event
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId || null,
        rambleId: ramble.id,
        action: 'exported',
        ipAddress: req.ip,
      },
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="ramble-${ramble.id}.txt"`);
    res.send(content);
  } catch (error) {
    next(error);
  }
});

export default router;
