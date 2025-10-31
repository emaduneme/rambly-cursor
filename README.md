# Rambly

> **Do you have something in mind? Start Rambly.**

Rambly is a mobile-first web app that records short voice ramblings, transcribes them, and returns a single polished note. Say it. We'll tidy it. Save it.

## Features

- **Quick Voice Recording**: Tap, talk, and capture your thoughts on any device
- **Automatic Transcription**: Powered by OpenAI Whisper for accurate speech-to-text
- **AI-Powered Polishing**: Transform rambling thoughts into clean, organized notes
- **Guest Mode**: Start recording immediately without sign-in (24-hour retention)
- **Google OAuth**: Sign in to save your rambles permanently across devices
- **Mobile-First Design**: Optimized for thumb-friendly interaction on phones
- **Privacy-Focused**: Delete rambles anytime, clear data retention policies
- **Export**: Download your transcripts and notes as text files

## Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Job Queue**: BullMQ (Redis-based)
- **Storage**: S3-compatible (AWS S3, MinIO, etc.)
- **Authentication**: Google OAuth 2.0 + JWT
- **AI Services**: OpenAI API (Whisper + GPT-4)

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Routing**: React Router v6

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx (production)

## Architecture

The application follows a clean, microservices-ready architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│         Landing → Record → Processing → Result → List       │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST API
┌───────────────────────▼─────────────────────────────────────┐
│                Backend API Server (Express)                  │
│  Auth Endpoints │ Rambles Endpoints │ Storage Service       │
│  Provider Adapters (Transcription + LLM - pluggable)        │
└───────┬───────────────────┬──────────────────┬──────────────┘
        │                   │                  │
        ▼                   ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │ Redis+BullMQ │  │  S3 Storage      │
│  (Database)  │  │ (Job Queue)  │  │  (Audio Files)   │
└──────────────┘  └──────┬───────┘  └──────────────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  Worker Process  │
                │  - Transcribe    │
                │  - Generate Note │
                │  - Cleanup Jobs  │
                └──────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## Prerequisites

- **Node.js** 20+ and npm 9+
- **Docker** and **Docker Compose** (for local development)
- **OpenAI API Key** (for transcription and note generation)
- **Google OAuth Credentials** (optional, for sign-in feature)

## Quick Start (Docker)

The fastest way to run Rambly locally:

### 1. Clone and Setup

```bash
git clone <repository-url>
cd rambly-cursor
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example backend/.env
```

Edit `backend/.env` and set:

```bash
# Required: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Google OAuth (leave blank to disable sign-in)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Optional: Customize JWT secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-jwt-secret-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
```

### 3. Start Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (ports 9000, 9001)
- Backend API (port 3001)
- Worker Process
- Frontend (port 5173)

### 4. Run Database Migrations

```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npx prisma generate
```

### 5. Open the App

Visit [http://localhost:5173](http://localhost:5173)

## Manual Setup (Without Docker)

If you prefer to run services locally without Docker:

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start Infrastructure

You'll need PostgreSQL, Redis, and S3-compatible storage running:

```bash
# Example using Homebrew (macOS)
brew install postgresql redis
brew services start postgresql redis

# Or use Docker just for infrastructure
docker-compose up -d postgres redis minio
```

### 3. Configure Database

```bash
# Create database
createdb rambly

# Set DATABASE_URL in backend/.env
DATABASE_URL=postgresql://localhost:5432/rambly
```

### 4. Run Migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 5. Start Services

```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Worker
cd backend
npm run worker

# Terminal 3: Frontend
cd frontend
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## Google OAuth Setup

To enable Google sign-in:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Set **Authorized redirect URIs**:
   - Development: `http://localhost:3001/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
6. Copy **Client ID** and **Client Secret** to `.env`

## Configuration

### Environment Variables

See [.env.example](./.env.example) for all available options.

**Key Settings:**

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for Whisper + GPT | Required |
| `TRANSCRIPTION_PROVIDER` | Transcription provider | `openai` |
| `LLM_PROVIDER` | LLM provider for polishing | `openai` |
| `GUEST_RAMBLE_EXPIRY_HOURS` | Guest ramble retention | `24` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Required |
| `S3_BUCKET` | S3 bucket name | `rambly-audio` |

### Provider Adapters

Rambly uses a **provider-agnostic adapter pattern**, making it easy to swap transcription and LLM providers:

```typescript
// backend/src/adapters/transcription/TranscriptionAdapterFactory.ts
// Add your own transcription provider:
case 'assemblyai':
  return new AssemblyAITranscriptionAdapter(env.ASSEMBLYAI_API_KEY);

// backend/src/adapters/llm/LLMAdapterFactory.ts
// Add your own LLM provider:
case 'anthropic':
  return new AnthropicLLMAdapter(env.ANTHROPIC_API_KEY);
```

## Project Structure

```
rambly-cursor/
├── backend/                    # Backend API server + worker
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── src/
│   │   ├── adapters/          # Provider adapters (transcription, LLM)
│   │   ├── config/            # Configuration (env, database, passport, redis)
│   │   ├── middleware/        # Express middleware (auth, error handling)
│   │   ├── routes/            # API routes (auth, rambles)
│   │   ├── services/          # Business logic (auth, storage)
│   │   ├── workers/           # Job queue processors
│   │   ├── utils/             # Utilities (logger, errors)
│   │   ├── server.ts          # API server entry point
│   │   └── worker.ts          # Worker process entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # Frontend React app
│   ├── src/
│   │   ├── api/               # API client and endpoints
│   │   ├── components/        # Reusable React components
│   │   ├── hooks/             # Custom hooks (audio recorder)
│   │   ├── pages/             # Page components (landing, record, result, etc.)
│   │   ├── store/             # Zustand state management
│   │   ├── types/             # TypeScript types
│   │   ├── App.tsx            # Main app component
│   │   └── main.tsx           # Entry point
│   ├── package.json
│   └── vite.config.ts
│
├── docker-compose.yml          # Local development stack
├── .env.example               # Example environment variables
├── ARCHITECTURE.md            # Detailed architecture docs
└── README.md                  # This file
```

## Development

### Backend Development

```bash
cd backend

# Run API server with hot reload
npm run dev

# Run worker with hot reload
npm run worker

# Run database migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Open Prisma Studio (database GUI)
npm run db:studio

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Frontend Development

```bash
cd frontend

# Run dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format
```

### Database Migrations

When you modify the Prisma schema:

```bash
cd backend

# Create migration
npx prisma migrate dev --name your_migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## Testing

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
cd frontend
npm test
```

### End-to-End Testing

Use the mobile device simulator in your browser:

1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select a mobile device (iPhone, Android)
4. Test the recording flow

## Deployment

### Production Checklist

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Configure production `DATABASE_URL`
- [ ] Set up production S3 bucket with encryption
- [ ] Enable HTTPS (set `COOKIE_SECURE=true`)
- [ ] Configure `CORS_ORIGIN` to your frontend domain
- [ ] Set up Google OAuth redirect URIs for production
- [ ] Set `NODE_ENV=production`
- [ ] Enable rate limiting (already configured)
- [ ] Set up monitoring and logging
- [ ] Configure automated backups for PostgreSQL

### Deployment Options

#### 1. AWS (Recommended for Scale)

- **Frontend**: CloudFront + S3 static hosting
- **Backend**: ECS Fargate (API + Worker containers)
- **Database**: RDS PostgreSQL
- **Cache**: ElastiCache Redis
- **Storage**: S3 with SSE-S3 encryption

#### 2. Google Cloud Platform

- **Frontend**: Cloud Storage + Cloud CDN
- **Backend**: Cloud Run (API + Worker)
- **Database**: Cloud SQL PostgreSQL
- **Cache**: Memorystore Redis
- **Storage**: Cloud Storage

#### 3. DigitalOcean (Cost-Effective)

- **App Platform**: Deploy from GitHub
- **Managed Database**: PostgreSQL + Redis
- **Spaces**: S3-compatible object storage

#### 4. Self-Hosted

- Use provided `docker-compose.yml`
- Set up reverse proxy (Nginx/Traefik)
- Configure SSL certificates (Let's Encrypt)
- Set up monitoring (Prometheus + Grafana)

### Example Deployment (DigitalOcean App Platform)

1. Fork this repository
2. Connect DigitalOcean App Platform to your GitHub repo
3. Configure environment variables in App Platform UI
4. Add Managed Database (PostgreSQL + Redis)
5. Add Spaces bucket for storage
6. Deploy!

## API Documentation

### Authentication

- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Rambles

- `POST /api/rambles` - Create ramble (upload audio)
- `GET /api/rambles` - List rambles (paginated)
- `GET /api/rambles/:id` - Get ramble details
- `GET /api/rambles/:id/status` - Get processing status
- `PATCH /api/rambles/:id` - Update ramble (title)
- `DELETE /api/rambles/:id` - Delete ramble
- `GET /api/rambles/:id/export` - Export transcript

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed API specs.

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Queue Dashboard

View job queue status:

```bash
# Install Bull Board (optional)
npm install -g bull-board

# Or check Redis directly
redis-cli
> KEYS bull:*
```

### Logs

```bash
# View logs (Docker)
docker-compose logs -f backend
docker-compose logs -f worker

# View logs (PM2 - if using)
pm2 logs
```

## Troubleshooting

### Microphone Permission Denied

- Ensure you're using HTTPS in production
- Check browser settings: chrome://settings/content/microphone
- Safari on iOS requires user interaction to request permissions

### Transcription Fails

- Verify `OPENAI_API_KEY` is set correctly
- Check OpenAI account has credits
- Review worker logs for errors

### Upload Fails

- Check S3 credentials and bucket configuration
- Ensure bucket CORS allows uploads
- Verify file size limits (default: 100MB)

### Database Connection Errors

- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall rules

### Worker Not Processing Jobs

- Ensure Redis is running
- Check `REDIS_URL` is correct
- Verify worker process is running
- Review worker logs for errors

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Roadmap

### MVP (Current)
- [x] Voice recording with waveform
- [x] OpenAI Whisper transcription
- [x] GPT-powered note polishing
- [x] Guest mode with auto-expire
- [x] Google OAuth sign-in
- [x] Mobile-first responsive UI
- [x] Docker-based development

### Future Features
- [ ] Multi-language support
- [ ] Editing UI for polished notes
- [ ] Share notes via link
- [ ] Export to notes apps (Notion, Evernote)
- [ ] Collaborative notes
- [ ] Custom prompt templates
- [ ] Desktop app (Electron)
- [ ] Native mobile apps (React Native)
- [ ] Offline-first recording
- [ ] Speaker diarization
- [ ] Real-time transcription

## Support

For issues, questions, or feature requests:

- **GitHub Issues**: [Create an issue](https://github.com/your-repo/rambly/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/rambly/discussions)

---

**Made with voice. Polished with AI.**

© 2025 Rambly
