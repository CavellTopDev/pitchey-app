# Pitchey Container Architecture - Complete Implementation

## 🎯 Overview

This document provides a comprehensive overview of the containerized microservices architecture created for Pitchey, featuring 5 specialized processing containers with complete production-ready configurations.

## 🏗️ Architecture Summary

### Container Services Implemented

| Service | Port | Purpose | Key Features |
|---------|------|---------|-------------|
| **Video Processor** | 8081 | Video processing, transcoding | FFmpeg, thumbnail generation, format conversion, analysis |
| **Document Processor** | 8082 | PDF generation, OCR, document manipulation | ReportLab, Tesseract OCR, watermarking, NDA templates |
| **AI Inference** | 8083 | AI/ML inference, text processing | OpenAI/Anthropic APIs, local models, sentiment analysis |
| **Media Transcoder** | 8084 | Adaptive streaming, HLS/DASH | Multi-bitrate encoding, live streaming, video optimization |
| **Code Executor** | 8085 | Secure code execution | Sandboxed Python/JS/SQL/TS execution, validation |

### Supporting Infrastructure

| Component | Port | Purpose |
|-----------|------|---------|
| **Nginx Gateway** | 80/443 | API Gateway, load balancing, SSL termination |
| **Redis Cache** | 6379 | Shared caching and session storage |
| **Prometheus** | 9090 | Metrics collection and monitoring |
| **Grafana** | 3000 | Visualization dashboards and alerting |

## 📁 Directory Structure

```
containers/
├── shared/                          # Common utilities
│   ├── health.py                   # Health check utilities
│   ├── security.py                 # Authentication & security
│   └── utils.py                    # File management & processing
│
├── video-processor/                # Video Processing Container
│   ├── Dockerfile                  # Multi-stage optimized build
│   ├── requirements.txt            # FFmpeg, OpenCV, video libraries
│   └── server.py                   # FastAPI server with processing endpoints
│
├── document-processor/             # Document Processing Container
│   ├── Dockerfile                  # PDF/OCR processing environment
│   ├── requirements.txt            # ReportLab, Tesseract, PyPDF2
│   ├── server.py                   # Document manipulation API
│   └── templates/                  # Document templates (NDA, contracts)
│
├── ai-inference/                   # AI/ML Inference Container
│   ├── Dockerfile                  # ML libraries and model support
│   ├── requirements.txt            # Transformers, OpenAI, Anthropic
│   └── server.py                   # AI inference and classification API
│
├── media-transcoder/               # Media Transcoding Container
│   ├── Dockerfile                  # Advanced FFmpeg with streaming
│   ├── requirements.txt            # HLS/DASH transcoding libraries
│   └── server.py                   # Adaptive streaming server
│
├── code-executor/                  # Secure Code Execution Container
│   ├── Dockerfile                  # Sandboxed execution environment
│   ├── requirements.txt            # Multi-language support
│   ├── server.py                   # Code execution and validation API
│   └── firejail.profile           # Security sandbox configuration
│
├── monitoring/                     # Monitoring Configuration
│   ├── prometheus.yml              # Metrics collection config
│   └── grafana/                    # Dashboard and datasource configs
│
├── docker-compose.yml              # Complete orchestration
├── nginx.conf                      # Gateway configuration
├── .env.example                    # Environment variables template
├── deploy.sh                       # Automated deployment script
└── README.md                       # Comprehensive documentation
```

## 🔧 Key Features Implemented

### Multi-Stage Docker Builds
- **Builder stage**: Compile dependencies and install build tools
- **Production stage**: Minimal runtime environment with only necessary components
- **Security**: Non-root users, resource limits, health checks
- **Optimization**: Layer caching, minimal image sizes

### Comprehensive API Endpoints

#### Video Processor (`/api/video/`)
- `POST /process` - Video transcoding with quality/format options
- `POST /thumbnail` - Generate video thumbnails at specific timestamps  
- `POST /compress` - Intelligent video compression with size targets
- `POST /analyze` - Extract video metadata and characteristics
- `GET /formats` - List supported input/output formats

#### Document Processor (`/api/document/`)
- `POST /generate-pdf` - Create PDFs from templates and data
- `POST /extract-text` - OCR and native text extraction
- `POST /watermark` - Add watermarks to PDF documents
- `POST /merge` - Combine multiple PDF files
- `GET /templates` - List available document templates

#### AI Inference (`/api/ai/`)
- `POST /analyze` - Comprehensive content analysis
- `POST /generate` - Text generation with multiple providers
- `POST /classify` - Text classification and sentiment analysis
- `POST /moderate` - Content moderation and safety checks
- `GET /models` - List available models and providers

#### Media Transcoder (`/api/media/`)
- `POST /hls-transcode` - Create HLS adaptive streams
- `POST /dash` - Generate DASH streaming content
- `POST /live-stream` - Set up live streaming endpoints
- `GET /streams` - List available streams and formats
- `GET /streams/{id}/master.m3u8` - HLS master playlists

#### Code Executor (`/api/code/`)
- `POST /execute` - Secure sandboxed code execution
- `POST /validate` - Code safety and syntax validation
- `POST /deploy` - Deployment simulation and preparation
- `GET /languages` - Supported programming languages
- `GET /security-policies` - Current security restrictions

### Security Implementation

#### Container Security
```dockerfile
# Non-root user creation
RUN groupadd -r pitchey && useradd -r -g pitchey -d /app pitchey
USER pitchey

# Resource limits
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3
```

#### Code Execution Security
- **Firejail sandboxing** - Network isolation, filesystem restrictions
- **Resource limits** - CPU time, memory, file descriptors
- **Syscall filtering** - Block dangerous system calls
- **Input validation** - AST parsing, pattern detection

#### API Security
- **JWT authentication** - Stateless token validation
- **API key validation** - Service-to-service authentication
- **Rate limiting** - Per-endpoint request throttling
- **Input sanitization** - File type and content validation

### Monitoring & Observability

#### Prometheus Metrics
```yaml
# Service health, request rates, resource usage
scrape_configs:
  - job_name: 'video-processor'
    static_configs:
      - targets: ['video-processor:8080']
```

#### Health Checks
```python
# Comprehensive health status
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "video-processor", 
        "uptime_seconds": uptime,
        "ready": True
    }
```

## 🚀 Deployment Options

### Docker Compose (Recommended)
```bash
# Full deployment
./deploy.sh

# Individual commands
docker-compose up -d
docker-compose logs -f
docker-compose scale video-processor=3
```

### Docker Swarm
```bash
docker swarm init
docker stack deploy -c docker-compose.yml pitchey-services
```

### Kubernetes
```bash
# Convert with Kompose
kompose convert
kubectl apply -f .
```

### Podman (Rootless)
```bash
podman-compose up -d
# OR generate Kubernetes YAML
podman generate kube pitchey-containers
```

## 📊 Resource Requirements

### Development Environment
- **CPU**: 4+ cores
- **RAM**: 8GB minimum, 16GB recommended
- **Disk**: 50GB for images and processing
- **Network**: 1Gbps for media processing

### Production Environment
- **CPU**: 8+ cores per node
- **RAM**: 16GB+ per node
- **Disk**: 200GB+ SSD storage
- **Network**: 10Gbps for high-throughput processing

### Per-Service Resource Allocation
```yaml
video-processor:    CPU: 2.0, Memory: 2GB
document-processor: CPU: 1.5, Memory: 1.5GB
ai-inference:       CPU: 3.0, Memory: 4GB
media-transcoder:   CPU: 2.5, Memory: 3GB
code-executor:      CPU: 1.5, Memory: 1GB
```

## 🔍 Production Considerations

### Scaling Strategies
- **Horizontal scaling** - Multiple instances behind load balancer
- **Vertical scaling** - Increase CPU/memory per container
- **Auto-scaling** - Based on queue depth and CPU utilization
- **Service mesh** - Advanced traffic management and observability

### Performance Optimization
- **Caching layers** - Redis for API responses and intermediate results
- **CDN integration** - For serving processed media content
- **Database pooling** - Shared connection pools across services
- **Async processing** - Background task queues for long-running operations

### Security Hardening
- **Network policies** - Restrict inter-service communication
- **Secrets management** - Vault or Kubernetes secrets
- **Image scanning** - Vulnerability assessment in CI/CD
- **Runtime security** - Falco or similar for runtime monitoring

### Backup & Recovery
- **Volume backups** - Persistent data and model caches
- **Configuration backups** - Docker configs and environment files
- **Disaster recovery** - Multi-region deployment strategies
- **Health monitoring** - Automated recovery and alerting

## 📈 Usage Examples

### Video Processing Workflow
```bash
# Upload and process video
curl -X POST "http://localhost/api/video/process" \
  -H "X-API-Key: your-api-key" \
  -F "file=@input.mp4" \
  -F "operation=transcode" \
  -F "format=webm" \
  -F "quality=high"

# Generate thumbnail
curl -X POST "http://localhost/api/video/thumbnail" \
  -H "X-API-Key: your-api-key" \
  -F "file=@input.mp4" \
  -F "timestamp=30.0" \
  -F "width=640" \
  -F "height=360"
```

### Document Processing Workflow
```bash
# Generate NDA from template
curl -X POST "http://localhost/api/document/generate-pdf" \
  -H "X-API-Key: your-api-key" \
  -F "template=nda" \
  -F 'data={"disclosing_party":"Pitchey Inc","receiving_party":"John Doe"}'

# OCR text extraction
curl -X POST "http://localhost/api/document/extract-text" \
  -H "X-API-Key: your-api-key" \
  -F "file=@document.pdf" \
  -F "method=ocr"
```

### AI Inference Workflow
```bash
# Content analysis
curl -X POST "http://localhost/api/ai/analyze" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"content":"This is a movie pitch about space exploration..."}'

# Text generation
curl -X POST "http://localhost/api/ai/generate" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Write a logline for a sci-fi movie","provider":"openai"}'
```

### Media Streaming Workflow
```bash
# Create HLS stream
curl -X POST "http://localhost/api/media/hls-transcode" \
  -H "X-API-Key: your-api-key" \
  -F "file=@movie.mp4" \
  -F "qualities=mobile,low,medium,high" \
  -F "stream_name=demo_stream"

# Access HLS playlist
curl "http://localhost/streams/demo_stream/master.m3u8"
```

### Code Execution Workflow
```bash
# Validate Python code
curl -X POST "http://localhost/api/code/validate" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"code":"print(\"Hello World\")","language":"python"}'

# Execute JavaScript securely
curl -X POST "http://localhost/api/code/execute" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"code":"console.log(\"Hello from sandbox\");","language":"javascript"}'
```

## 🔮 Future Enhancements

### Planned Features
- **GPU acceleration** - NVIDIA CUDA support for AI inference and video processing
- **Edge deployment** - Lightweight variants for edge computing
- **WebAssembly support** - Browser-based code execution
- **Advanced streaming** - WebRTC for low-latency streaming
- **Blockchain integration** - Content verification and rights management

### Integration Opportunities
- **Cloudflare Workers** - Edge processing integration
- **AWS Lambda** - Serverless fallback for overflow processing
- **Kubernetes Operators** - Custom resource definitions for automated management
- **Service Mesh** - Istio/Linkerd for advanced traffic management

## 📞 Support & Maintenance

### Monitoring Dashboards
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Service Health**: http://localhost/health

### Common Operations
```bash
# View all service logs
docker-compose logs -f

# Scale specific service
docker-compose up --scale video-processor=3

# Update specific service
docker-compose build video-processor
docker-compose up -d --no-deps video-processor

# Backup volumes
docker run --volumes-from pitchey-redis -v $(pwd):/backup alpine tar czf /backup/redis_backup.tar.gz /data
```

### Troubleshooting
1. **Check service health endpoints**: `curl http://localhost:8081/health`
2. **Review container logs**: `docker-compose logs service-name`
3. **Monitor resource usage**: `docker stats`
4. **Verify network connectivity**: `docker-compose exec service-name ping other-service`

---

## 🎉 Implementation Complete

This containerized architecture provides Pitchey with:

✅ **5 Specialized Processing Services** - Video, Document, AI, Media, Code  
✅ **Production-Ready Infrastructure** - Gateway, Monitoring, Caching  
✅ **Comprehensive Security** - Sandboxing, Authentication, Rate Limiting  
✅ **Complete Documentation** - APIs, Deployment, Operations  
✅ **Automated Deployment** - One-command deployment with health checks  
✅ **Scalable Architecture** - Horizontal scaling and resource optimization  
✅ **Multi-Platform Support** - Docker, Swarm, Kubernetes, Podman compatible  

The entire system is ready for immediate development use and production deployment with appropriate configuration adjustments.