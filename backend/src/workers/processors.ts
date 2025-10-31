import { Job } from 'bullmq';
import { prisma } from '../config/database';
import { storageService } from '../services/StorageService';
import { TranscriptionAdapterFactory } from '../adapters/transcription/TranscriptionAdapterFactory';
import { LLMAdapterFactory } from '../adapters/llm/LLMAdapterFactory';
import { logger } from '../utils/logger';
import { TranscribeJobData, GenerateNoteJobData, CleanupJobData, generateNoteQueue } from './queue';
import { RambleStatus } from '@prisma/client';

/**
 * Process transcription job
 */
export async function processTranscribeJob(job: Job<TranscribeJobData>) {
  const { rambleId, storageKey, language } = job.data;

  logger.info('Processing transcription job', {
    jobId: job.id,
    rambleId,
    storageKey,
  });

  try {
    // Update ramble status
    await prisma.ramble.update({
      where: { id: rambleId },
      data: { status: RambleStatus.processing },
    });

    // Download audio from storage
    const audioBuffer = await storageService.downloadAudio(storageKey);

    // Get transcription adapter
    const transcriptionAdapter = TranscriptionAdapterFactory.create();

    // Transcribe audio
    const result = await transcriptionAdapter.transcribe(audioBuffer, {
      language,
      format: 'webm', // Default format
    });

    // Save transcript to database
    const transcript = await prisma.transcript.create({
      data: {
        rambleId,
        rawText: result.rawText,
        confidence: result.confidence ? result.confidence.toString() : null,
        segments: result.segments || [],
      },
    });

    // Update ramble with language and duration
    await prisma.ramble.update({
      where: { id: rambleId },
      data: {
        language: result.language,
        durationSeconds: result.duration ? Math.round(result.duration) : null,
      },
    });

    logger.info('Transcription completed', {
      jobId: job.id,
      rambleId,
      transcriptId: transcript.id,
      textLength: result.rawText.length,
    });

    // Enqueue note generation job
    await generateNoteQueue.add('generate-note', {
      rambleId,
      transcriptId: transcript.id,
    });

    return { transcriptId: transcript.id };
  } catch (error: any) {
    logger.error('Transcription job failed', {
      jobId: job.id,
      rambleId,
      error: error.message,
      stack: error.stack,
    });

    // Update ramble status to failed
    await prisma.ramble.update({
      where: { id: rambleId },
      data: {
        status: RambleStatus.failed,
        metadata: {
          error: error.message,
          failedAt: new Date().toISOString(),
        },
      },
    });

    throw error;
  }
}

/**
 * Process note generation job
 */
export async function processGenerateNoteJob(job: Job<GenerateNoteJobData>) {
  const { rambleId, transcriptId } = job.data;

  logger.info('Processing note generation job', {
    jobId: job.id,
    rambleId,
    transcriptId,
  });

  try {
    // Get transcript
    const transcript = await prisma.transcript.findUnique({
      where: { id: transcriptId },
    });

    if (!transcript) {
      throw new Error(`Transcript ${transcriptId} not found`);
    }

    // Get LLM adapter
    const llmAdapter = LLMAdapterFactory.create();

    // Generate polished note
    const result = await llmAdapter.generatePolishedNote(transcript.rawText, {
      formattingType: 'paragraphs',
    });

    // Save polished note to database
    const polishedNote = await prisma.polishedNote.create({
      data: {
        rambleId,
        content: result.content,
        formattingType: result.formattingType,
        modelMeta: result.metadata,
      },
    });

    // Update ramble status to ready and auto-generate title
    const title = generateTitleFromTranscript(transcript.rawText);
    await prisma.ramble.update({
      where: { id: rambleId },
      data: {
        status: RambleStatus.ready,
        title,
      },
    });

    logger.info('Note generation completed', {
      jobId: job.id,
      rambleId,
      polishedNoteId: polishedNote.id,
      contentLength: result.content.length,
    });

    return { polishedNoteId: polishedNote.id };
  } catch (error: any) {
    logger.error('Note generation job failed', {
      jobId: job.id,
      rambleId,
      error: error.message,
      stack: error.stack,
    });

    // Update ramble status to failed
    await prisma.ramble.update({
      where: { id: rambleId },
      data: {
        status: RambleStatus.failed,
        metadata: {
          error: error.message,
          failedAt: new Date().toISOString(),
        },
      },
    });

    throw error;
  }
}

/**
 * Process cleanup job (delete expired guest rambles)
 */
export async function processCleanupJob(job: Job<CleanupJobData>) {
  logger.info('Processing cleanup job', {
    jobId: job.id,
    type: job.data.type,
  });

  try {
    if (job.data.type === 'expired_guest_rambles') {
      // Find expired guest rambles
      const expiredRambles = await prisma.ramble.findMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
          status: {
            not: RambleStatus.deleted,
          },
        },
        include: {
          audioBlob: true,
        },
      });

      logger.info(`Found ${expiredRambles.length} expired guest rambles to delete`);

      for (const ramble of expiredRambles) {
        try {
          // Delete audio from storage
          if (ramble.audioBlob) {
            await storageService.deleteAudio(ramble.audioBlob.storageKey);
          }

          // Soft delete ramble (cascade deletes related records)
          await prisma.ramble.update({
            where: { id: ramble.id },
            data: { status: RambleStatus.deleted },
          });

          logger.info('Deleted expired guest ramble', { rambleId: ramble.id });
        } catch (error: any) {
          logger.error('Failed to delete expired ramble', {
            rambleId: ramble.id,
            error: error.message,
          });
        }
      }

      return { deletedCount: expiredRambles.length };
    }

    return { message: 'Unknown cleanup type' };
  } catch (error: any) {
    logger.error('Cleanup job failed', {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Helper function to generate title from transcript
 */
function generateTitleFromTranscript(transcript: string): string {
  // Take first sentence or first 50 characters
  const firstSentence = transcript.split(/[.!?]/)[0]?.trim();
  const title = firstSentence || transcript.substring(0, 50);

  // Clean up and truncate
  return title.substring(0, 100).replace(/\s+/g, ' ').trim();
}
