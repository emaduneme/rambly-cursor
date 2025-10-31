import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  API_URL: z.string().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string(),

  // S3 Storage
  S3_BUCKET: z.string(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_ENDPOINT: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().default('false'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Providers
  TRANSCRIPTION_PROVIDER: z.enum(['openai', 'whisper', 'assemblyai']).default('openai'),
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'cohere']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Guest Settings
  GUEST_RAMBLE_EXPIRY_HOURS: z.string().default('24'),

  // Security
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100'),

  // Cookie
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.string().default('false'),
  COOKIE_SAME_SITE: z.enum(['strict', 'lax', 'none']).default('lax'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const env = {
  ...parsedEnv.data,
  PORT: parseInt(parsedEnv.data.PORT, 10),
  GUEST_RAMBLE_EXPIRY_HOURS: parseInt(parsedEnv.data.GUEST_RAMBLE_EXPIRY_HOURS, 10),
  RATE_LIMIT_WINDOW_MS: parseInt(parsedEnv.data.RATE_LIMIT_WINDOW_MS, 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(parsedEnv.data.RATE_LIMIT_MAX_REQUESTS, 10),
  S3_FORCE_PATH_STYLE: parsedEnv.data.S3_FORCE_PATH_STYLE === 'true',
  COOKIE_SECURE: parsedEnv.data.COOKIE_SECURE === 'true',
  isDevelopment: parsedEnv.data.NODE_ENV === 'development',
  isProduction: parsedEnv.data.NODE_ENV === 'production',
  isTest: parsedEnv.data.NODE_ENV === 'test',
};
