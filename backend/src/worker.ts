import { Worker } from 'bullmq';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { env } from './config/env';
import {
  processTranscribeJob,
  processGenerateNoteJob,
  processCleanupJob,
} from './workers/processors';
import { TranscribeJobData, GenerateNoteJobData, CleanupJobData } from './workers/queue';

const connection = {
  host: env.REDIS_URL.includes('://') ? new URL(env.REDIS_URL).hostname : 'localhost',
  port: env.REDIS_URL.includes('://') ? parseInt(new URL(env.REDIS_URL).port || '6379') : 6379,
};

async function startWorkers() {
  try {
    // Connect to database
    await connectDatabase();

    // Create workers
    const transcribeWorker = new Worker<TranscribeJobData>(
      'transcribe',
      async (job) => {
        return await processTranscribeJob(job);
      },
      {
        connection,
        concurrency: 3, // Process 3 transcription jobs in parallel
      }
    );

    const generateNoteWorker = new Worker<GenerateNoteJobData>(
      'generate-note',
      async (job) => {
        return await processGenerateNoteJob(job);
      },
      {
        connection,
        concurrency: 5, // Process 5 note generation jobs in parallel
      }
    );

    const cleanupWorker = new Worker<CleanupJobData>(
      'cleanup',
      async (job) => {
        return await processCleanupJob(job);
      },
      {
        connection,
        concurrency: 1, // Cleanup jobs run one at a time
      }
    );

    // Worker event listeners
    transcribeWorker.on('completed', (job) => {
      logger.info('Transcribe job completed', {
        jobId: job.id,
        rambleId: job.data.rambleId,
      });
    });

    transcribeWorker.on('failed', (job, error) => {
      logger.error('Transcribe job failed', {
        jobId: job?.id,
        rambleId: job?.data.rambleId,
        error: error.message,
      });
    });

    generateNoteWorker.on('completed', (job) => {
      logger.info('Generate note job completed', {
        jobId: job.id,
        rambleId: job.data.rambleId,
      });
    });

    generateNoteWorker.on('failed', (job, error) => {
      logger.error('Generate note job failed', {
        jobId: job?.id,
        rambleId: job?.data.rambleId,
        error: error.message,
      });
    });

    cleanupWorker.on('completed', (job) => {
      logger.info('Cleanup job completed', {
        jobId: job.id,
        type: job.data.type,
      });
    });

    cleanupWorker.on('failed', (job, error) => {
      logger.error('Cleanup job failed', {
        jobId: job?.id,
        type: job?.data.type,
        error: error.message,
      });
    });

    logger.info('✅ Workers started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing workers...');
      await transcribeWorker.close();
      await generateNoteWorker.close();
      await cleanupWorker.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, closing workers...');
      await transcribeWorker.close();
      await generateNoteWorker.close();
      await cleanupWorker.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start workers', { error });
    process.exit(1);
  }
}

// Start workers
startWorkers();
