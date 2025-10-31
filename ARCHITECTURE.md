# Rambly - Architecture Documentation

## Overview

Rambly is a mobile-first web application that records voice ramblings, transcribes them, and returns polished notes. This document outlines the technical architecture for the MVP.

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite (fast dev server, optimized production builds)
- **Styling**: CSS Modules + Tailwind CSS (mobile-first responsive design)
- **Audio Recording**: MediaRecorder API with waveform visualization
- **State Management**: React Context + hooks
- **HTTP Client**: Axios
- **Routing**: React Router v6

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15+
- **ORM**: Prisma (type-safe, migrations, easy schema evolution)
- **Job Queue**: BullMQ (Redis-based, robust retry logic)
- **Object Storage**: S3-compatible (AWS S3, MinIO, etc.)
- **Authentication**: Passport.js (Google OAuth 2.0)
- **Session**: JWT (short-lived access tokens)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (production)
- **Process Manager**: PM2 (optional for non-container deployments)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Landing │  │ Recording│  │Processing│  │  Results │   │
│  │   Page   │→ │    UI    │→ │    UI    │→ │   View   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS/REST API
┌───────────────────────▼─────────────────────────────────────┐
│                    Backend API Server (Express)              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Auth      │  │   Rambles    │  │   Storage    │       │
│  │  Endpoints  │  │  Endpoints   │  │  Endpoints   │       │
│  └─────────────┘  └──────────────┘  └──────────────┘       │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │         Provider Adapters (Strategy Pattern)      │       │
│  │  ┌───────────────────┐  ┌─────────────────────┐ │       │
│  │  │ Transcription API │  │  LLM Generation API │ │       │
│  │  │  (OpenAI, etc)    │  │   (OpenAI, etc)     │ │       │
│  │  └───────────────────┘  └─────────────────────┘ │       │
│  └──────────────────────────────────────────────────┘       │
└───────┬───────────────────┬──────────────────┬──────────────┘
        │                   │                  │
        ▼                   ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │  Job Queue   │  │  Object Storage  │
│  (Database)  │  │   (Redis)    │  │   (S3/MinIO)     │
└──────────────┘  └──────┬───────┘  └──────────────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  Worker Process  │
                │  (BullMQ Worker) │
                │                  │
                │  - Transcribe    │
                │  - Generate Note │
                └──────────────────┘
```

## Data Flow

### Recording Flow (Guest or Authenticated)
1. User visits landing page
2. Clicks "Start Rambly" → microphone permission requested
3. Records audio (MediaRecorder API captures audio chunks)
4. Clicks "Stop" → audio blob created
5. Frontend uploads audio to backend (POST /api/record)
6. Backend:
   - Creates ramble record in DB (status: 'uploading')
   - Stores audio in object storage
   - Enqueues transcription job
   - Returns ramble ID
7. Frontend polls for status (GET /api/rambles/{id}/status)
8. Worker picks up job:
   - Downloads audio from storage
   - Calls transcription adapter → raw transcript
   - Calls LLM adapter → polished note
   - Updates ramble status to 'ready'
9. Frontend receives completed status
10. User sees results: transcript + polished note

### Authentication Flow
1. User clicks "Sign in with Google"
2. Backend redirects to Google OAuth consent screen
3. Google redirects back with authorization code
4. Backend exchanges code for user info
5. Backend creates/updates user record
6. Backend issues JWT access token
7. Frontend stores token (httpOnly cookie or localStorage)
8. Frontend includes token in subsequent requests

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id VARCHAR(255) UNIQUE NOT NULL, -- Google user ID
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);
```

### Rambles Table
```sql
CREATE TABLE rambles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255), -- For guest users
  title VARCHAR(500),
  status VARCHAR(50) NOT NULL, -- 'uploading', 'processing', 'ready', 'failed', 'deleted'
  duration_seconds INTEGER,
  language VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- For guest rambles (24h auto-expire)
  metadata JSONB DEFAULT '{}'::jsonb,
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at)
);
```

### Audio Blobs Table
```sql
CREATE TABLE audio_blobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ramble_id UUID UNIQUE REFERENCES rambles(id) ON DELETE CASCADE,
  storage_url VARCHAR(1000) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  content_type VARCHAR(100),
  size_bytes BIGINT,
  checksum VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Transcripts Table
```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ramble_id UUID UNIQUE REFERENCES rambles(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  confidence DECIMAL(5,4),
  segments JSONB, -- [{text, start, end, confidence}]
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Polished Notes Table
```sql
CREATE TABLE polished_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ramble_id UUID UNIQUE REFERENCES rambles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  formatting_type VARCHAR(50), -- 'paragraphs', 'bullets'
  generated_at TIMESTAMP DEFAULT NOW(),
  model_meta JSONB -- {provider, model, version, tokens_used}
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ramble_id UUID,
  action VARCHAR(100) NOT NULL, -- 'created', 'deleted', 'exported', 'viewed'
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

## API Endpoints

### Authentication
- `POST /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### Rambles
- `POST /api/rambles` - Create new ramble (upload audio)
- `GET /api/rambles` - List user's rambles (paginated)
- `GET /api/rambles/:id` - Get ramble details (includes transcript + note)
- `GET /api/rambles/:id/status` - Get processing status
- `PATCH /api/rambles/:id` - Update ramble (e.g., change title)
- `DELETE /api/rambles/:id` - Delete ramble (soft delete with cascade)
- `POST /api/rambles/:id/regenerate` - Regenerate polished note
- `GET /api/rambles/:id/export` - Export transcript as .txt

### Guest Session
- `POST /api/guest/session` - Create guest session ID
- `POST /api/guest/convert` - Convert guest rambles to authenticated user

## Provider Adapters

### Transcription Adapter Interface
```typescript
interface TranscriptionAdapter {
  transcribe(audioBuffer: Buffer, options: TranscriptionOptions): Promise<TranscriptionResult>;
}

interface TranscriptionOptions {
  language?: string;
  format?: 'mp3' | 'wav' | 'webm';
}

interface TranscriptionResult {
  raw_text: string;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  confidence?: number;
  language?: string;
}
```

### LLM Adapter Interface
```typescript
interface LLMAdapter {
  generatePolishedNote(transcript: string, options: GenerationOptions): Promise<PolishedNoteResult>;
}

interface GenerationOptions {
  formattingType?: 'paragraphs' | 'bullets';
  maxLength?: number;
}

interface PolishedNoteResult {
  content: string;
  formattingType: string;
  metadata: {
    provider: string;
    model: string;
    tokensUsed?: number;
  };
}
```

### Implementation Strategy
- Create abstract base classes/interfaces
- Implement concrete adapters (OpenAI, Whisper, etc.)
- Use factory pattern to instantiate based on config
- Easy to add new providers without changing core logic

## Job Queue Architecture

### Jobs
1. **TranscribeJob**: Download audio → call transcription adapter → save transcript
2. **GenerateNoteJob**: Fetch transcript → call LLM adapter → save polished note
3. **CleanupJob**: Cron job to delete expired guest rambles and audio files

### Worker Configuration
- Concurrency: configurable (default: 2-5 workers)
- Retry logic: exponential backoff, max 3 retries
- Job timeout: 5 minutes per job
- Dead letter queue: failed jobs after max retries

## Security & Privacy

### Data Protection
- **Encryption at rest**: S3 server-side encryption (SSE-S3 or SSE-KMS)
- **Encryption in transit**: TLS 1.3 for all API calls
- **Database**: PostgreSQL with encrypted connections
- **Secrets**: Environment variables (never commit to repo)

### Privacy Features
1. **Guest auto-expire**: Rambles auto-delete after 24h unless saved
2. **User delete**: Cascade delete audio + transcript + note + audit logs
3. **Data export**: Provide JSON export of all user data
4. **Minimal telemetry**: No content logging, only success/failure metrics

### Authentication
- **JWT**: Short-lived access tokens (15 min), refresh tokens (7 days)
- **Google OAuth**: Verify tokens server-side
- **CSRF protection**: Double-submit cookie pattern
- **Rate limiting**: Per-IP and per-user rate limits

## Configuration & Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3001
API_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/rambly

# Redis (Job Queue)
REDIS_URL=redis://localhost:6379

# Object Storage (S3)
S3_BUCKET=rambly-audio
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
S3_ENDPOINT=https://s3.amazonaws.com # or MinIO endpoint

# Auth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
JWT_SECRET=xxx
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=xxx
JWT_REFRESH_EXPIRES_IN=7d

# Transcription Provider
TRANSCRIPTION_PROVIDER=openai # or 'whisper', 'assemblyai'
OPENAI_API_KEY=sk-xxx

# LLM Provider
LLM_PROVIDER=openai # or 'anthropic', 'cohere'
# Uses same OPENAI_API_KEY as above

# Guest Session
GUEST_RAMBLE_EXPIRY_HOURS=24

# Security
CORS_ORIGIN=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000 # 15 min
RATE_LIMIT_MAX_REQUESTS=100
```

## Deployment

### Docker Compose (Local Development)
```yaml
services:
  postgres:
    image: postgres:15-alpine
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio
  backend:
    build: ./backend
    depends_on: [postgres, redis, minio]
  worker:
    build: ./backend
    command: npm run worker
    depends_on: [postgres, redis, minio]
  frontend:
    build: ./frontend
```

### Production Deployment Options
1. **AWS**: ECS Fargate (containers) + RDS (Postgres) + ElastiCache (Redis) + S3
2. **Google Cloud**: Cloud Run + Cloud SQL + Memorystore + Cloud Storage
3. **DigitalOcean**: App Platform + Managed Database + Spaces
4. **Self-hosted**: Docker Swarm or Kubernetes + managed DB + S3-compatible storage

## Monitoring & Observability

### Metrics to Track
- Request latency (p50, p95, p99)
- Error rate by endpoint
- Transcription success/failure rate
- Average processing time (transcribe + generate)
- Storage used (audio + DB)
- Active users (DAU, WAU, MAU)
- Queue depth and processing lag

### Logging
- **Structured logs**: JSON format with correlation IDs
- **Log levels**: error, warn, info, debug
- **What to log**:
  - API requests (exclude auth tokens)
  - Job processing events
  - Errors with stack traces
- **What NOT to log**: audio content, transcripts, user PII

### Tools
- **APM**: New Relic, Datadog, or open-source APM
- **Logs**: CloudWatch, Papertrail, or Loki
- **Alerts**: PagerDuty for critical errors

## Scalability Considerations

### Bottlenecks
1. **Transcription API rate limits**: Queue requests, implement retry logic
2. **Worker capacity**: Scale worker count horizontally
3. **Storage costs**: Implement lifecycle policies (delete old guest audio)
4. **Database queries**: Add indexes, use connection pooling

### Scaling Strategy
- **Horizontal**: Add more worker instances
- **Vertical**: Increase worker resources for large files
- **Caching**: Redis cache for frequently accessed rambles
- **CDN**: Serve frontend static assets via CDN

## Testing Strategy

### Backend
- **Unit tests**: Adapters, business logic (Jest)
- **Integration tests**: API endpoints (Supertest)
- **E2E tests**: Full flow with test database

### Frontend
- **Component tests**: React Testing Library
- **E2E tests**: Playwright (mobile viewport testing)

### CI/CD
- GitHub Actions: lint → test → build → deploy
- Automated tests on PR
- Deploy to staging on merge to main
- Manual promotion to production

## Future Extensibility

### Prepared for:
1. **Multi-language support**: Language detection already in schema
2. **Editing UI**: Polished notes are stored separately from transcripts
3. **Collaborative notes**: User schema can be extended for sharing
4. **Native apps**: Backend API is platform-agnostic
5. **Local-first**: Audio can be recorded offline, uploaded later
6. **Custom prompts**: LLM adapter can accept custom system prompts

---

**Last Updated**: 2025-10-31
**Version**: 1.0.0 (MVP)
