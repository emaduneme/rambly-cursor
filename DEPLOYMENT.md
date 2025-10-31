# Deployment Guide

This guide covers deploying Rambly to production.

## Pre-Deployment Checklist

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (use `openssl rand -base64 32`)
- [ ] Configure production `DATABASE_URL` with SSL enabled
- [ ] Set up production S3 bucket with server-side encryption
- [ ] Enable HTTPS (set `COOKIE_SECURE=true`)
- [ ] Configure `CORS_ORIGIN` to your frontend domain(s)
- [ ] Set up Google OAuth redirect URIs for production domain
- [ ] Set `NODE_ENV=production`
- [ ] Configure monitoring and alerting
- [ ] Set up automated database backups
- [ ] Test the full user flow in staging environment

## Option 1: AWS Deployment

### Architecture

```
CloudFront (CDN)
    ↓
S3 (Frontend)

ALB (Load Balancer)
    ↓
ECS Fargate (Backend API + Worker)
    ↓
RDS PostgreSQL + ElastiCache Redis + S3 (Storage)
```

### Step-by-Step

#### 1. Create RDS PostgreSQL Database

```bash
aws rds create-db-instance \
  --db-instance-identifier rambly-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username rambly \
  --master-user-password YourStrongPassword \
  --allocated-storage 20 \
  --storage-encrypted \
  --backup-retention-period 7
```

#### 2. Create ElastiCache Redis

```bash
aws elasticache create-replication-group \
  --replication-group-id rambly-redis \
  --replication-group-description "Rambly job queue" \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-clusters 1
```

#### 3. Create S3 Bucket

```bash
aws s3 mb s3://rambly-production-audio
aws s3api put-bucket-encryption \
  --bucket rambly-production-audio \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

#### 4. Build and Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Create repositories
aws ecr create-repository --repository-name rambly-backend
aws ecr create-repository --repository-name rambly-frontend

# Build and push backend
cd backend
docker build -t rambly-backend .
docker tag rambly-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/rambly-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/rambly-backend:latest

# Build and push frontend
cd ../frontend
docker build -t rambly-frontend .
docker tag rambly-frontend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/rambly-frontend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/rambly-frontend:latest
```

#### 5. Create ECS Task Definitions

Create `ecs-backend-task.json`:

```json
{
  "family": "rambly-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/rambly-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3001"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
        {"name": "REDIS_URL", "valueFrom": "arn:aws:secretsmanager:..."},
        {"name": "OPENAI_API_KEY", "valueFrom": "arn:aws:secretsmanager:..."}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/rambly-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

Register task:

```bash
aws ecs register-task-definition --cli-input-json file://ecs-backend-task.json
```

#### 6. Create ECS Services

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name rambly-cluster

# Create API service
aws ecs create-service \
  --cluster rambly-cluster \
  --service-name rambly-backend \
  --task-definition rambly-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"

# Create worker service
aws ecs create-service \
  --cluster rambly-cluster \
  --service-name rambly-worker \
  --task-definition rambly-worker \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

#### 7. Deploy Frontend to S3 + CloudFront

```bash
# Build frontend
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://rambly-frontend --delete

# Create CloudFront distribution (via console or CLI)
# Point to S3 bucket, configure custom domain, enable HTTPS
```

## Option 2: DigitalOcean App Platform

### Step-by-Step

#### 1. Create Managed Database

- Go to DigitalOcean console
- Create Managed PostgreSQL database
- Create Managed Redis database
- Note connection strings

#### 2. Create Spaces Bucket

- Create Spaces bucket (S3-compatible)
- Generate access keys
- Note endpoint URL

#### 3. Deploy via App Platform

```yaml
# app.yaml
name: rambly
region: nyc

databases:
  - name: db
    engine: PG
    version: "15"
  - name: redis
    engine: REDIS
    version: "7"

services:
  - name: backend
    github:
      repo: your-username/rambly
      branch: main
      deploy_on_push: true
    source_dir: /backend
    build_command: npm run build
    run_command: npm start
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        scope: RUN_AND_BUILD_TIME
        type: SECRET
      - key: REDIS_URL
        scope: RUN_AND_BUILD_TIME
        type: SECRET
      - key: OPENAI_API_KEY
        scope: RUN_AND_BUILD_TIME
        type: SECRET

  - name: worker
    github:
      repo: your-username/rambly
      branch: main
      deploy_on_push: true
    source_dir: /backend
    build_command: npm run build
    run_command: npm run worker:prod
    envs:
      - key: NODE_ENV
        value: production

  - name: frontend
    github:
      repo: your-username/rambly
      branch: main
      deploy_on_push: true
    source_dir: /frontend
    build_command: npm run build
    output_dir: /dist
    routes:
      - path: /
```

Deploy:

```bash
doctl apps create --spec app.yaml
```

## Option 3: Self-Hosted (VPS)

### Requirements

- Ubuntu 22.04 LTS
- 2GB+ RAM
- Docker and Docker Compose installed
- Domain name with DNS configured
- SSL certificate (Let's Encrypt)

### Step-by-Step

#### 1. Setup Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx -y
```

#### 2. Clone Repository

```bash
git clone <your-repo-url>
cd rambly-cursor
```

#### 3. Configure Environment

```bash
cp .env.example backend/.env
nano backend/.env
# Fill in production values
```

#### 4. Setup SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### 5. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/rambly`:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/rambly /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 6. Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### 7. Run Migrations

```bash
docker-compose exec backend npx prisma migrate deploy
```

#### 8. Setup Automatic SSL Renewal

```bash
sudo crontab -e
# Add: 0 0 * * * certbot renew --quiet
```

## Monitoring

### AWS CloudWatch

- Set up alarms for CPU, memory, error rates
- Configure log aggregation
- Set up dashboards

### Sentry (Error Tracking)

```bash
npm install @sentry/node @sentry/tracing

# Add to backend/src/server.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### Uptime Monitoring

- Use UptimeRobot, Pingdom, or StatusCake
- Monitor `/health` endpoint

## Scaling Strategies

### Horizontal Scaling

- Add more ECS tasks or app instances
- Use auto-scaling based on CPU/memory metrics

### Database Scaling

- Enable read replicas for read-heavy workloads
- Use connection pooling (PgBouncer)
- Consider sharding for very large datasets

### Worker Scaling

- Increase worker concurrency
- Add more worker instances
- Use separate queues for different priorities

### CDN

- Use CloudFront or Cloudflare for frontend
- Cache static assets aggressively
- Enable Gzip compression

## Backup and Disaster Recovery

### Database Backups

```bash
# Automated daily backups (AWS RDS)
aws rds modify-db-instance \
  --db-instance-identifier rambly-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00"

# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Audio File Backups

```bash
# Enable S3 versioning
aws s3api put-bucket-versioning \
  --bucket rambly-production-audio \
  --versioning-configuration Status=Enabled

# Lifecycle policy for old versions
aws s3api put-bucket-lifecycle-configuration \
  --bucket rambly-production-audio \
  --lifecycle-configuration file://lifecycle.json
```

## Cost Optimization

- Use Fargate Spot instances for workers (70% savings)
- Enable S3 Intelligent-Tiering for audio files
- Use Aurora Serverless for variable workloads
- Implement aggressive caching
- Archive old guest rambles to Glacier

## Troubleshooting

### Check Service Health

```bash
# AWS ECS
aws ecs describe-services --cluster rambly-cluster --services rambly-backend

# DigitalOcean
doctl apps list

# Self-hosted
docker-compose ps
docker-compose logs backend
```

### Database Issues

```bash
# Check connections
SELECT count(*) FROM pg_stat_activity;

# Kill stuck connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';
```

### Worker Issues

```bash
# Check queue depth
redis-cli
> LLEN bull:transcribe:wait

# Clear failed jobs
> DEL bull:transcribe:failed
```

---

For more help, see [README.md](./README.md) or open an issue.
