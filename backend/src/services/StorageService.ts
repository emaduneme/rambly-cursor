import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class StorageService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    this.s3Client = new S3Client({
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });

    this.bucket = env.S3_BUCKET;
  }

  /**
   * Upload audio file to S3
   */
  async uploadAudio(
    buffer: Buffer,
    rambleId: string,
    contentType: string
  ): Promise<{ storageKey: string; storageUrl: string; checksum: string }> {
    try {
      const extension = this.getExtensionFromContentType(contentType);
      const storageKey = `audio/${rambleId}/${uuidv4()}${extension}`;

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          rambleId,
          checksum,
        },
      });

      await this.s3Client.send(command);

      const storageUrl = this.getPublicUrl(storageKey);

      logger.info('Audio uploaded to S3', {
        storageKey,
        size: buffer.length,
        rambleId,
      });

      return { storageKey, storageUrl, checksum };
    } catch (error: any) {
      logger.error('S3 upload failed', {
        error: error.message,
        rambleId,
      });
      throw new Error(`Failed to upload audio: ${error.message}`);
    }
  }

  /**
   * Download audio file from S3
   */
  async downloadAudio(storageKey: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new Error('Empty response from S3');
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      logger.info('Audio downloaded from S3', {
        storageKey,
        size: buffer.length,
      });

      return buffer;
    } catch (error: any) {
      logger.error('S3 download failed', {
        error: error.message,
        storageKey,
      });
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }

  /**
   * Delete audio file from S3
   */
  async deleteAudio(storageKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      await this.s3Client.send(command);

      logger.info('Audio deleted from S3', { storageKey });
    } catch (error: any) {
      logger.error('S3 delete failed', {
        error: error.message,
        storageKey,
      });
      throw new Error(`Failed to delete audio: ${error.message}`);
    }
  }

  /**
   * Check if audio file exists
   */
  async audioExists(storageKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generate presigned URL for direct upload (optional - for future use)
   */
  async getPresignedUploadUrl(
    rambleId: string,
    contentType: string,
    expiresIn = 3600
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    const extension = this.getExtensionFromContentType(contentType);
    const storageKey = `audio/${rambleId}/${uuidv4()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn,
    });

    return { uploadUrl, storageKey };
  }

  /**
   * Generate presigned URL for download
   */
  async getPresignedDownloadUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get public URL (for internal use, not presigned)
   */
  private getPublicUrl(storageKey: string): string {
    if (env.S3_ENDPOINT) {
      return `${env.S3_ENDPOINT}/${this.bucket}/${storageKey}`;
    }
    return `https://${this.bucket}.s3.${env.S3_REGION}.amazonaws.com/${storageKey}`;
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const map: Record<string, string> = {
      'audio/webm': '.webm',
      'audio/webm;codecs=opus': '.webm',
      'audio/mp3': '.mp3',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/mp4': '.m4a',
      'audio/x-m4a': '.m4a',
    };

    return map[contentType] || '.webm';
  }
}

// Singleton instance
export const storageService = new StorageService();
