import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const connection = {
  host: env.REDIS_URL.includes('://') ? new URL(env.REDIS_URL).hostname : 'localhost',
  port: env.REDIS_URL.includes('://') ? parseInt(new URL(env.REDIS_URL).port || '6379') : 6379,
};

// Job data types
export interface TranscribeJobData {
  rambleId: string;
  storageKey: string;
  language?: string;
}

export interface GenerateNoteJobData {
  rambleId: string;
  transcriptId: string;
}

export interface CleanupJobData {
  type: 'expired_guest_rambles';
}

// Create queues
export const transcribeQueue = new Queue<TranscribeJobData>('transcribe', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs for debugging
    },
  },
});

export const generateNoteQueue = new Queue<GenerateNoteJobData>('generate-note', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

export const cleanupQueue = new Queue<CleanupJobData>('cleanup', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Queue event listeners
transcribeQueue.on('error', (error) => {
  logger.error('Transcribe queue error', { error: error.message });
});

generateNoteQueue.on('error', (error) => {
  logger.error('Generate note queue error', { error: error.message });
});

cleanupQueue.on('error', (error) => {
  logger.error('Cleanup queue error', { error: error.message });
});

logger.info('✅ Job queues initialized');

export { Job };
