# Pitchey Container Services

A comprehensive containerized microservices architecture for Pitchey's specialized processing needs, including video processing, document handling, AI inference, media transcoding, and secure code execution.

## 🏗️ Architecture Overview

This container setup provides 5 specialized processing services plus supporting infrastructure:

### Core Services

1. **Video Processor** (Port 8081)
   - Video transcoding and compression
   - Thumbnail generation
   - Format conversion (MP4, WebM, MOV, etc.)
   - Metadata analysis

2. **Document Processor** (Port 8082)
   - PDF generation from templates
   - OCR text extraction
   - Document watermarking and merging
   - NDA template processing

3. **AI Inference** (Port 8083)
   - Text classification and sentiment analysis
   - Content generation (OpenAI, Anthropic, local models)
   - Content moderation
   - Multi-provider AI integration

4. **Media Transcoder** (Port 8084)
   - HLS/DASH adaptive streaming
   - Multi-bitrate encoding
   - Live streaming endpoints
   - Video quality optimization

5. **Code Executor** (Port 8085)
   - Sandboxed code execution (Python, JS, SQL, TypeScript)
   - Code validation and security scanning
   - Deployment simulation
   - Multi-language support

### Supporting Infrastructure

- **Nginx Gateway** (Port 80/443) - API Gateway, load balancing, SSL termination
- **Redis Cache** (Port 6379) - Shared caching and session storage
- **Prometheus** (Port 9090) - Metrics collection
- **Grafana** (Port 3000) - Monitoring dashboards

## 🚀 Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 8GB+ RAM recommended
- 50GB+ disk space

### Installation

1. **Clone and navigate to containers directory:**
   ```bash
   cd containers/
   ```

2. **Copy and configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Verify deployment:**
   ```bash
   curl http://localhost/health
   ```

### Service Health Checks

```bash
# Check all service health
for port in 8081 8082 8083 8084 8085; do
  echo "Checking port $port:"
  curl -s http://localhost:$port/health | jq '.'
done
```

## 📖 API Documentation

Each service provides OpenAPI/Swagger documentation:

- Video Processor: http://localhost:8081/docs
- Document Processor: http://localhost:8082/docs  
- AI Inference: http://localhost:8083/docs
- Media Transcoder: http://localhost:8084/docs
- Code Executor: http://localhost:8085/docs

### Gateway Endpoints

All services are accessible through the Nginx gateway:

```bash
# Video processing
POST http://localhost/api/video/process
POST http://localhost/api/video/thumbnail
POST http://localhost/api/video/analyze

# Document processing
POST http://localhost/api/document/generate-pdf
POST http://localhost/api/document/extract-text
POST http://localhost/api/document/watermark

# AI inference
POST http://localhost/api/ai/analyze
POST http://localhost/api/ai/generate
POST http://localhost/api/ai/classify

# Media transcoding
POST http://localhost/api/media/hls-transcode
POST http://localhost/api/media/dash
GET http://localhost/streams/{stream-id}/master.m3u8

# Code execution
POST http://localhost/api/code/execute
POST http://localhost/api/code/validate
POST http://localhost/api/code/deploy
```

## 🔐 Security Features

### Container Security
- Non-root users in all containers
- Multi-stage builds for minimal attack surface
- Resource limits (CPU, memory, file descriptors)
- Network isolation
- Read-only root filesystems where possible

### Code Execution Security
- Firejail sandboxing
- Syscall filtering (seccomp)
- Resource limits (CPU time, memory)
- Network isolation
- Filesystem restrictions
- Execution timeouts

### API Security
- JWT authentication
- API key validation
- Rate limiting
- Input validation
- File type restrictions
- Content security policies

## 📊 Monitoring

### Prometheus Metrics
- Service health and uptime
- Request rates and latency
- Resource usage (CPU, memory)
- Error rates
- Queue depths

### Grafana Dashboards
Access Grafana at http://localhost:3000 (admin/admin)

- Service Overview Dashboard
- Resource Usage Dashboard
- Error Tracking Dashboard
- Performance Metrics Dashboard

### Health Checks
```bash
# Individual service health
curl http://localhost:8081/health

# Readiness probes
curl http://localhost:8081/ready

# System stats (authenticated)
curl -H "X-API-Key: your-api-key" http://localhost:8083/stats
```

## 🔧 Configuration

### Environment Variables

Key configuration options in `.env`:

```bash
# Authentication
JWT_SECRET=your-secret-here
API_KEY_DEFAULT=your-api-key

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...

# Resource Limits
MAX_FILE_SIZE=500000000
MAX_WORKERS=3
DEBUG=false
```

### Service-Specific Configuration

Each service supports additional environment variables:

```bash
# Video Processor
VIDEO_PROCESSOR_QUALITY=medium
VIDEO_PROCESSOR_FORMATS=mp4,webm,mov

# Document Processor
DOCUMENT_PROCESSOR_OCR_LANGUAGE=eng
DOCUMENT_PROCESSOR_TEMPLATE_DIR=/app/templates

# AI Inference
AI_INFERENCE_DEFAULT_MODEL=gpt-3.5-turbo
AI_INFERENCE_CACHE_TTL=3600

# Media Transcoder
MEDIA_TRANSCODER_HLS_SEGMENT_TIME=6
MEDIA_TRANSCODER_QUALITIES=mobile,low,medium,high

# Code Executor
CODE_EXECUTOR_TIMEOUT=30
CODE_EXECUTOR_MEMORY_LIMIT=256M
```

## 🛠️ Development

### Building Individual Services

```bash
# Build specific service
docker-compose build video-processor

# Build with no cache
docker-compose build --no-cache ai-inference

# Build and start specific service
docker-compose up --build document-processor
```

### Debugging

```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f video-processor

# Execute shell in running container
docker-compose exec video-processor bash

# Check container resource usage
docker stats
```

### Development Mode

Enable debug mode for development:

```bash
# Set in .env
DEBUG=true

# Restart services
docker-compose restart
```

## 🚀 Production Deployment

### Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml pitchey-services
```

### Kubernetes

Convert with Kompose:

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.30.0/kompose-linux-amd64 -o kompose
chmod +x kompose && sudo mv kompose /usr/local/bin/

# Convert to Kubernetes manifests
kompose convert
```

### Podman Support

For Podman compatibility:

```bash
# Generate Kubernetes YAML
podman generate kube pitchey-containers > pitchey-k8s.yaml

# Run with podman-compose
pip install podman-compose
podman-compose up -d
```

## 📈 Performance Optimization

### Resource Allocation

Recommended production resource allocation:

```yaml
video-processor:    CPU: 2.0, Memory: 2GB
document-processor: CPU: 1.5, Memory: 1.5GB  
ai-inference:       CPU: 3.0, Memory: 4GB
media-transcoder:   CPU: 2.5, Memory: 3GB
code-executor:      CPU: 1.5, Memory: 1GB
redis:              CPU: 0.5, Memory: 512MB
nginx:              CPU: 0.5, Memory: 256MB
```

### Scaling

```bash
# Scale specific services
docker-compose up --scale video-processor=3 --scale ai-inference=2

# Auto-scaling with Docker Swarm
docker service update --replicas 5 pitchey-services_video-processor
```

### Caching

Configure Redis caching:

```bash
# Redis memory optimization
REDIS_MAXMEMORY=512mb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Service-specific cache TTL
CACHE_TTL=3600
AI_INFERENCE_CACHE_TTL=7200
```

## 🔍 Troubleshooting

### Common Issues

**Services not starting:**
```bash
# Check logs
docker-compose logs

# Verify resource availability
docker system df
docker system prune
```

**Port conflicts:**
```bash
# Check port usage
netstat -tulpn | grep :8081

# Modify ports in docker-compose.yml
```

**Performance issues:**
```bash
# Monitor resource usage
docker stats

# Check container limits
docker inspect container-name | grep -i memory
```

**AI models not loading:**
```bash
# Check disk space for model cache
df -h

# Clear model cache
docker volume rm containers_ai_cache
```

### Logs and Debugging

```bash
# Enable debug logging
echo "DEBUG=true" >> .env
docker-compose restart

# Follow logs in real-time
docker-compose logs -f --tail=100

# Export logs for analysis
docker-compose logs > pitchey-services.log
```

## 📝 License

This container architecture is part of the Pitchey platform. See the main project license for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test container changes locally
4. Submit a pull request with container tests

## 🆘 Support

For container-specific issues:

1. Check service health endpoints
2. Review container logs
3. Verify resource allocation
4. Test with minimal configuration
5. Open an issue with container version info

---

**Container Version:** 1.0.0  
**Last Updated:** January 2026  
**Maintainer:** Pitchey Development Team