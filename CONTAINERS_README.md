# Pitchey Cloudflare Containers Implementation

## 🏗️ Architecture Overview

This implementation extends the Pitchey platform with **Cloudflare Containers** for heavy computational workloads while maintaining the existing serverless architecture.

### Core Components

```mermaid
graph TB
    subgraph "Frontend Layer"
        FE[Cloudflare Pages<br/>React Frontend]
    end
    
    subgraph "API Gateway"
        WORKER[Cloudflare Worker<br/>API & Orchestration]
    end
    
    subgraph "Container Services"
        VP[Video Processor<br/>standard-2]
        DP[Document Processor<br/>standard-1]  
        AI[AI Inference<br/>standard-4]
        MT[Media Transcoder<br/>standard-2]
        CE[Code Executor<br/>lite]
    end
    
    subgraph "Queue System"
        VQ[Video Queue]
        DQ[Document Queue]
        AQ[AI Queue]
        MQ[Media Queue]
        CQ[Code Queue]
        DLQ[Dead Letter Queues]
    end
    
    subgraph "Storage & Database"
        R2[Cloudflare R2<br/>Object Storage]
        HD[Hyperdrive<br/>Database Connection]
        KV[KV Namespaces<br/>Caching & Jobs]
        NEON[(Neon PostgreSQL<br/>Primary Database)]
        REDIS[(Upstash Redis<br/>Cache Layer)]
    end
    
    FE --> WORKER
    WORKER --> VP
    WORKER --> DP
    WORKER --> AI
    WORKER --> MT
    WORKER --> CE
    
    WORKER --> VQ
    WORKER --> DQ
    WORKER --> AQ
    WORKER --> MQ
    WORKER --> CQ
    
    VQ --> VP
    DQ --> DP
    AQ --> AI
    MQ --> MT
    CQ --> CE
    
    VP --> R2
    DP --> R2
    AI --> R2
    MT --> R2
    CE --> R2
    
    WORKER --> HD
    HD --> NEON
    WORKER --> KV
    WORKER --> REDIS
```

## 🚀 Quick Start

### 1. Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login

# Install Podman (for local development)
# Ubuntu/Debian:
sudo apt-get install podman

# macOS:
brew install podman
```

### 2. Environment Setup

```bash
# Clone the repository
cd /home/supremeisbeing/pitcheymovie/pitchey_v0.2

# Set environment variables
export DATABASE_URL="postgresql://neondb_owner:npg_YibeIGRuv40J@ep-old-snow-a9pr94lc-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
export REDIS_URL="your-upstash-redis-url"
export SENTRY_DSN="your-sentry-dsn"
export OPENAI_API_KEY="your-openai-api-key"
export CLOUDFLARE_API_TOKEN="your-cloudflare-token"
export WEBHOOK_SIGNING_SECRET="your-webhook-secret"
export ENCRYPTION_KEY="your-encryption-key"
```

### 3. Deploy Containers

```bash
# Deploy to production
./deploy-containers.sh production

# Deploy to staging
./deploy-containers.sh staging

# Deploy for development
./deploy-containers.sh development
```

## 🐳 Container Services

### 1. Video Processor Container

**Purpose**: Video transcoding, thumbnail generation, and format conversion

**Configuration**:
- **Instance Type**: `standard-2` (2 CPU, 4GB RAM)
- **Auto-scaling**: 1-10 instances
- **Max Processing Time**: 30 minutes
- **Supported Formats**: MP4, MOV, AVI, MKV

**Endpoints**:
```http
POST /video-processor
{
  "job_id": "uuid",
  "input_url": "https://r2-bucket/input.mp4",
  "output_format": "mp4",
  "quality": "1080p",
  "thumbnail_count": 5
}
```

### 2. Document Processor Container

**Purpose**: PDF processing, text extraction, OCR, document conversion

**Configuration**:
- **Instance Type**: `standard-1` (1 CPU, 2GB RAM)
- **Auto-scaling**: 1-5 instances
- **Max Processing Time**: 5 minutes
- **Supported Formats**: PDF, DOCX, PPTX, XLSX

**Endpoints**:
```http
POST /document-processor
{
  "job_id": "uuid",
  "document_url": "https://r2-bucket/document.pdf",
  "extract_text": true,
  "generate_preview": true,
  "ocr_enabled": false
}
```

### 3. AI Inference Container

**Purpose**: ML model inference, pitch analysis, sentiment analysis, content summarization

**Configuration**:
- **Instance Type**: `standard-4` (4 CPU, 8GB RAM)
- **Auto-scaling**: 2-5 instances
- **Max Processing Time**: 2 minutes
- **Models**: pitch-analyzer-v2, sentiment-v1, summarizer-v3

**Endpoints**:
```http
POST /ai-inference
{
  "job_id": "uuid",
  "model": "pitch-analyzer-v2",
  "input_data": {...},
  "parameters": {"temperature": 0.7}
}
```

### 4. Media Transcoder Container

**Purpose**: Audio/video optimization, format conversion, compression

**Configuration**:
- **Instance Type**: `standard-2` (2 CPU, 4GB RAM)
- **Auto-scaling**: 1-5 instances
- **Max Processing Time**: 10 minutes
- **Presets**: web-optimized, mobile-optimized, hd-quality

**Endpoints**:
```http
POST /media-transcoder
{
  "job_id": "uuid",
  "input_media": "https://r2-bucket/media.mov",
  "output_presets": ["web-optimized"],
  "generate_thumbnails": true
}
```

### 5. Code Executor Container (Sandbox)

**Purpose**: Safe code execution, validation, testing

**Configuration**:
- **Instance Type**: `lite` (0.5 CPU, 1GB RAM)
- **Auto-scaling**: 2-10 instances
- **Max Processing Time**: 30 seconds
- **Languages**: JavaScript, Python, TypeScript

**Endpoints**:
```http
POST /code-executor
{
  "job_id": "uuid",
  "language": "javascript",
  "code": "console.log('Hello World');",
  "timeout": 30,
  "memory_limit": 512
}
```

## 📊 Queue Management

### Queue Configuration

| Queue Name | Purpose | Batch Size | Timeout | Retries | DLQ |
|------------|---------|------------|---------|---------|-----|
| `pitchey-video-jobs` | Video processing | 5 | 300s | 3 | ✅ |
| `pitchey-document-jobs` | Document processing | 10 | 60s | 3 | ✅ |
| `pitchey-ai-jobs` | AI inference | 8 | 180s | 2 | ✅ |
| `pitchey-media-jobs` | Media transcoding | 3 | 600s | 3 | ✅ |
| `pitchey-code-jobs` | Code execution | 20 | 30s | 1 | ✅ |

### Job Submission

```typescript
import { ContainerOrchestrator } from './src/services/container-orchestrator';

const orchestrator = new ContainerOrchestrator(env);

// Submit a video processing job
const jobId = await orchestrator.submitJob({
  type: 'video-processing',
  payload: {
    input_url: 'https://r2-bucket/video.mp4',
    output_format: 'mp4',
    quality: '1080p'
  },
  priority: 'high'
});

// Check job status
const status = await orchestrator.getJobStatus(jobId);
```

## 🗃️ Database Schema

### Core Tables

#### `container_jobs`
Tracks all containerized processing jobs with full lifecycle management.

```sql
CREATE TABLE container_jobs (
    id UUID PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    container_id UUID,
    retry_count INTEGER DEFAULT 0,
    result JSONB,
    processing_time_seconds INTEGER,
    estimated_cost_usd DECIMAL(10, 4)
);
```

#### `container_instances`
Active container instances with health and resource monitoring.

```sql
CREATE TABLE container_instances (
    id UUID PRIMARY KEY,
    container_type VARCHAR(50) NOT NULL,
    instance_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'starting',
    cpu_usage_percent DECIMAL(5, 2),
    memory_usage_percent DECIMAL(5, 2),
    active_jobs_count INTEGER DEFAULT 0
);
```

### Apply Schema

```bash
# Apply container schema
psql $DATABASE_URL -f src/db/container-schema.sql
```

## 🔧 Configuration Files

### `wrangler-containers.toml`

Comprehensive Cloudflare Workers configuration with:
- 5 container definitions with auto-scaling
- Queue system with dead letter queues
- R2 storage bindings
- KV namespaces for job tracking
- Hyperdrive database integration
- Environment-specific settings

### Key Configuration Sections

```toml
# Container definition example
[[containers]]
name = "VideoProcessorContainer"
image = "pitchey/video-processor:latest"
instance_type = "standard-2"
min_instances = 1
max_instances = 10

# Queue configuration
[[queues.producers]]
binding = "VIDEO_PROCESSING_QUEUE"
queue = "pitchey-video-jobs"

[[queues.consumers]]
queue = "pitchey-video-jobs"
max_batch_size = 5
max_batch_timeout = 300
max_retries = 3
dead_letter_queue = "pitchey-video-dlq"
```

## 💰 Cost Optimization

### Estimated Monthly Costs

| Container Type | Instance Type | Max Instances | Est. Cost/Month |
|---------------|---------------|---------------|-----------------|
| Video Processor | standard-2 | 10 | $150-300 |
| Document Processor | standard-1 | 5 | $60-120 |
| AI Inference | standard-4 | 5 | $200-400 |
| Media Transcoder | standard-2 | 5 | $75-150 |
| Code Executor | lite | 10 | $30-60 |
| **Total** | | | **$515-1030** |

### Cost Optimization Features

1. **Auto-scaling**: Containers scale down when idle
2. **Queue batching**: Process multiple jobs efficiently
3. **Resource monitoring**: Track usage and optimize
4. **Cost alerts**: Automated budget notifications
5. **Idle timeouts**: Stop unused containers automatically

## 📈 Monitoring & Analytics

### Health Checks

```bash
# Check container health
curl https://containers.pitchey.com/video-processor/health
curl https://containers.pitchey.com/document-processor/health
curl https://containers.pitchey.com/ai-inference/health
curl https://containers.pitchey.com/media-transcoder/health
curl https://containers.pitchey.com/code-executor/health

# Check orchestrator health
curl https://pitchey-api-prod.ndlovucavelle.workers.dev/health/containers
```

### Metrics Dashboard

Access real-time metrics via database views:

```sql
-- Container dashboard
SELECT * FROM container_dashboard;

-- Job performance metrics
SELECT * FROM job_performance_metrics;

-- Cost analysis
SELECT * FROM container_cost_analysis;
```

### Webhook Alerts

Configure monitoring webhooks in `wrangler-containers.toml`:

```toml
[webhooks]
container_health = "https://pitchey-monitoring.webhook.com/container-health"
job_failure = "https://pitchey-monitoring.webhook.com/job-failure"
scaling_events = "https://pitchey-monitoring.webhook.com/scaling"
cost_alerts = "https://pitchey-monitoring.webhook.com/cost-alerts"
```

## 🏠 Local Development

### Podman Setup

```bash
# Start Podman containers locally
podman-compose up -d

# Or use provided script
./podman-local.sh
```

### Development Workflow

```bash
# Start local proxy (port 8001)
PORT=8001 deno run --allow-all working-server.ts

# Start frontend development server
cd frontend && npm run dev

# Test container endpoints locally
curl http://localhost:8001/api/containers/health
```

## 🚢 Deployment Strategies

### Environments

- **Development**: Limited scaling, debug logging enabled
- **Staging**: Production-like setup with reduced limits
- **Production**: Full auto-scaling, monitoring, and optimization

### Rollout Strategy

```toml
[rollout]
strategy = "canary"
canary_percentage = 10
success_rate_threshold = 99.5
error_rate_threshold = 0.1
rollback_on_failure = true
```

### Deployment Commands

```bash
# Production deployment
./deploy-containers.sh production

# Staging deployment
./deploy-containers.sh staging

# Development deployment
./deploy-containers.sh development
```

## 🔐 Security

### Container Isolation

- **Network isolation**: Containers can't access each other
- **Sandboxed execution**: Code executor runs in restricted environment
- **Resource limits**: CPU and memory constraints enforced
- **Timeout protection**: Jobs have maximum execution time

### Access Control

- **API authentication**: Bearer tokens for container access
- **Row-level security**: Database access restricted by organization
- **Role-based permissions**: Admin, operator, and user roles
- **Request signing**: Webhook payload verification

## 📝 API Integration

### Worker Integration

```typescript
// Add to existing worker-integrated.ts
import { ContainerOrchestrator } from './services/container-orchestrator';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const orchestrator = new ContainerOrchestrator(env);
    
    // Submit container job
    if (url.pathname === '/api/containers/submit') {
      const jobId = await orchestrator.submitJob(jobData);
      return Response.json({ jobId });
    }
    
    // Get job status
    if (url.pathname.startsWith('/api/containers/status/')) {
      const jobId = url.pathname.split('/').pop();
      const status = await orchestrator.getJobStatus(jobId);
      return Response.json(status);
    }
  }
};
```

### Frontend Integration

```typescript
// Frontend service for container jobs
export class ContainerService {
  async submitVideoProcessing(videoFile: File): Promise<string> {
    const response = await fetch('/api/containers/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video-processing',
        payload: { input_url: await this.uploadFile(videoFile) },
        priority: 'high'
      })
    });
    
    const { jobId } = await response.json();
    return jobId;
  }
  
  async getJobStatus(jobId: string) {
    const response = await fetch(`/api/containers/status/${jobId}`);
    return response.json();
  }
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Container startup failures**
   ```bash
   # Check container logs
   wrangler tail --format=pretty
   
   # Verify container health
   curl https://containers.pitchey.com/video-processor/health
   ```

2. **Queue processing delays**
   ```sql
   -- Check queue depths
   SELECT type, COUNT(*) FROM container_jobs 
   WHERE status IN ('pending', 'processing') 
   GROUP BY type;
   ```

3. **High costs**
   ```sql
   -- Check cost breakdown
   SELECT * FROM container_cost_analysis 
   WHERE date > CURRENT_DATE - INTERVAL '7 days';
   ```

### Performance Tuning

1. **Batch size optimization**: Adjust queue batch sizes based on job complexity
2. **Auto-scaling thresholds**: Fine-tune CPU/memory thresholds
3. **Container pre-warming**: Keep minimum instances ready
4. **Queue prioritization**: Use priority levels for urgent jobs

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Containers (Beta)](https://developers.cloudflare.com/workers/containers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [Podman Documentation](https://docs.podman.io/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with local container setup
5. Submit a pull request

## 📄 License

This implementation is part of the Pitchey platform and follows the same licensing terms.