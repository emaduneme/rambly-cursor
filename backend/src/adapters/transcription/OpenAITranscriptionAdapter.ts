import OpenAI from 'openai';
import { TranscriptionAdapter, TranscriptionOptions, TranscriptionResult } from '../../types/adapters';
import { logger } from '../../utils/logger';
import { ServiceUnavailableError } from '../../utils/errors';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class OpenAITranscriptionAdapter implements TranscriptionAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required for transcription');
    }
    this.client = new OpenAI({ apiKey });
  }

  async transcribe(
    audioBuffer: Buffer,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    try {
      logger.info('Starting OpenAI Whisper transcription', {
        bufferSize: audioBuffer.length,
        language: options?.language,
        format: options?.format,
      });

      // OpenAI requires a file, so create a temporary file
      const tempDir = os.tmpdir();
      const tempFileName = `audio-${Date.now()}.${options?.format || 'webm'}`;
      const tempFilePath = path.join(tempDir, tempFileName);

      await fs.promises.writeFile(tempFilePath, audioBuffer);

      try {
        // Use Whisper API with verbose_json for segments
        const response = await this.client.audio.transcriptions.create({
          file: fs.createReadStream(tempFilePath) as any,
          model: 'whisper-1',
          language: options?.language,
          prompt: options?.prompt,
          response_format: 'verbose_json',
        });

        logger.info('OpenAI transcription successful', {
          textLength: response.text.length,
          language: response.language,
          duration: response.duration,
        });

        // Parse segments if available
        const segments = (response as any).segments?.map((seg: any) => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
          confidence: seg.no_speech_prob ? 1 - seg.no_speech_prob : undefined,
        }));

        return {
          rawText: response.text,
          segments,
          language: response.language,
          duration: response.duration,
        };
      } finally {
        // Clean up temp file
        await fs.promises.unlink(tempFilePath).catch((err) => {
          logger.warn('Failed to delete temp file', { path: tempFilePath, error: err.message });
        });
      }
    } catch (error: any) {
      logger.error('OpenAI transcription failed', {
        error: error.message,
        status: error.response?.status,
      });

      if (error.response?.status === 429) {
        throw new ServiceUnavailableError('Transcription service rate limit exceeded');
      }

      throw new ServiceUnavailableError(
        `Transcription failed: ${error.message || 'Unknown error'}`
      );
    }
  }

  getProviderName(): string {
    return 'openai';
  }
}
