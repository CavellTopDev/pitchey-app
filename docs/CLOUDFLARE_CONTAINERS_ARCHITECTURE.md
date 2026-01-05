# Pitchey Cloudflare Containers Architecture

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Container Services](#container-services)
4. [Data Flow and Communication](#data-flow-and-communication)
5. [Integration with Existing Infrastructure](#integration-with-existing-infrastructure)
6. [Scalability and Performance](#scalability-and-performance)
7. [High-Level System Diagrams](#high-level-system-diagrams)

## Executive Summary

The Pitchey Cloudflare Containers implementation provides a comprehensive microservices architecture that extends the platform's capabilities through containerized processing services. This system enables scalable, cost-effective processing of media, documents, AI inference, and code execution through a sophisticated orchestration layer.

### Key Benefits

- **Scale-to-Zero Architecture**: Containers automatically scale down when idle, minimizing costs
- **Multi-Runtime Support**: Compatible with both Docker and Podman for flexible deployment options
- **Edge-First Processing**: Leverages Cloudflare's global network for optimal performance
- **Comprehensive Job Management**: Full lifecycle tracking with retry mechanisms and error handling
- **Cost Optimization**: Real-time cost tracking and budget management

### Technical Highlights

- **5 Specialized Container Services**: Video processing, document processing, AI inference, media transcoding, and code execution
- **Advanced Orchestration**: Intelligent job routing with priority queuing and dead letter queue handling
- **Persistent State Management**: SQLite/PostgreSQL integration for job tracking and metrics
- **Auto-Scaling**: Dynamic scaling based on queue depth and resource utilization
- **Security First**: Container isolation, resource limits, and comprehensive access controls

## System Architecture Overview

### High-Level Architecture

The Pitchey container system follows a distributed microservices pattern with the following core components:

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Cloudflare        │    │   Container         │    │   Storage &         │
│   Workers API       │    │   Orchestrator      │    │   Database          │
│                     │    │                     │    │                     │
│ ┌─────────────────┐ │    │ ┌─────────────────┐ │    │ ┌─────────────────┐ │
│ │ Main Worker     │ │◄──►│ │ Job Queue       │ │    │ │ Neon PostgreSQL │ │
│ │ (Entry Point)   │ │    │ │ Management      │ │    │ │ (Job Tracking)  │ │
│ └─────────────────┘ │    │ └─────────────────┘ │    │ └─────────────────┘ │
│                     │    │                     │    │                     │
│ ┌─────────────────┐ │    │ ┌─────────────────┐ │    │ ┌─────────────────┐ │
│ │ Queue Consumers │ │◄──►│ │ Container Pool  │ │    │ │ Cloudflare KV   │ │
│ │ (5 Services)    │ │    │ │ Manager         │ │    │ │ (Job Status)    │ │
│ └─────────────────┘ │    │ └─────────────────┘ │    │ └─────────────────┘ │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                          │                          │
           │                          │                          │
           ▼                          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Container Service Layer                             │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────┐ │
│  │   Video     │  │  Document   │  │     AI      │  │   Media     │  │Code│ │
│  │ Processor   │  │ Processor   │  │ Inference   │  │ Transcoder  │  │Exec│ │
│  │             │  │             │  │             │  │             │  │    │ │
│  │ • FFmpeg    │  │ • PDF OCR   │  │ • ML Models │  │ • Audio Enc │  │• JS│ │
│  │ • Transcode │  │ • Text Ext  │  │ • Analysis  │  │ • Streaming │  │• Py│ │
│  │ • Thumbnail │  │ • Preview   │  │ • Inference │  │ • Optimize  │  │• Go│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### 1. Cloudflare Workers API Layer
- **Main Worker**: Central entry point handling all API requests
- **Queue Consumers**: Specialized consumers for each container service type
- **Job Routing**: Intelligent routing based on job type and priority
- **Error Handling**: Comprehensive error handling with retry mechanisms

#### 2. Container Orchestrator
- **Job Queue Management**: Priority-based job queuing and distribution
- **Container Pool Management**: Dynamic container scaling and lifecycle management
- **Health Monitoring**: Continuous health checks and automatic recovery
- **Cost Tracking**: Real-time cost monitoring and budget management

#### 3. Storage and Database Layer
- **PostgreSQL**: Persistent job tracking, metrics, and audit trails
- **Cloudflare KV**: Fast access to job status and temporary data
- **R2 Storage**: Input/output file storage for processing jobs

#### 4. Container Service Layer
Five specialized microservices, each optimized for specific processing tasks.

## Container Services

### 1. Video Processor Container

**Purpose**: Advanced video processing using FFmpeg with comprehensive format support

**Capabilities**:
- **Transcoding**: Multi-format video conversion (MP4, WebM, HLS)
- **Quality Optimization**: Adaptive bitrate encoding with multiple quality tiers
- **Thumbnail Generation**: Automatic thumbnail extraction at specified intervals
- **Watermarking**: Text and image watermarks with positioning control
- **Scene Detection**: Intelligent scene boundary detection for content analysis
- **Audio Extraction**: Separate audio track extraction and processing

**Technical Specifications**:
```typescript
interface VideoProcessingJob {
  inputUrl: string;
  outputFormat: 'mp4' | 'webm' | 'hls' | 'thumbnail';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  resolution?: string;
  bitrate?: string;
  framerate?: number;
  thumbnailTimes?: number[];
  watermark?: {
    text?: string;
    imageUrl?: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity: number;
  };
}
```

**Resource Requirements**:
- **Instance Type**: standard-2 (2 vCPU, 2GB RAM)
- **Storage**: Ephemeral storage for processing
- **Network**: High bandwidth for video streaming
- **Concurrency**: Maximum 3 concurrent jobs per container

### 2. Document Processor Container

**Purpose**: Comprehensive document processing with OCR and format conversion

**Capabilities**:
- **Format Support**: PDF, DOCX, TXT, HTML, Markdown
- **OCR Processing**: Optical Character Recognition for scanned documents
- **Text Extraction**: Clean text extraction preserving structure
- **Preview Generation**: Thumbnail and preview image generation
- **Metadata Extraction**: Document properties and content analysis
- **Format Conversion**: Cross-format document conversion

**Technical Specifications**:
```typescript
interface DocumentProcessingJob {
  documentUrl: string;
  outputFormats: ('text' | 'html' | 'markdown' | 'preview')[];
  ocrEnabled: boolean;
  language: string;
  extractImages: boolean;
  generatePreview: boolean;
}
```

**Resource Requirements**:
- **Instance Type**: standard-1 (1 vCPU, 1GB RAM)
- **Storage**: Temporary storage for document processing
- **Concurrency**: Maximum 5 concurrent jobs per container

### 3. AI Inference Container

**Purpose**: Machine learning model inference and analysis

**Capabilities**:
- **Model Support**: TensorFlow, PyTorch, ONNX models
- **Text Analysis**: Sentiment analysis, entity recognition, summarization
- **Image Analysis**: Object detection, classification, feature extraction
- **Content Moderation**: Automated content safety analysis
- **Recommendation Engine**: Collaborative and content-based filtering
- **Natural Language Processing**: Text classification and analysis

**Technical Specifications**:
```typescript
interface AIInferenceJob {
  model: string;
  inputData: any;
  parameters: {
    temperature?: number;
    maxTokens?: number;
    threshold?: number;
  };
  outputFormat: 'json' | 'text' | 'binary';
}
```

**Resource Requirements**:
- **Instance Type**: standard-4 (4 vCPU, 8GB RAM)
- **GPU**: Optional GPU acceleration for inference
- **Concurrency**: Maximum 2 concurrent jobs per container

### 4. Media Transcoder Container

**Purpose**: Audio and media optimization for web delivery

**Capabilities**:
- **Audio Encoding**: MP3, AAC, OGG, FLAC encoding
- **Streaming Optimization**: HLS and DASH manifest generation
- **Podcast Processing**: Chapter markers and metadata handling
- **Audio Enhancement**: Noise reduction and normalization
- **Compression**: Adaptive bitrate optimization
- **Format Conversion**: Cross-platform media format support

**Technical Specifications**:
```typescript
interface MediaTranscodingJob {
  inputMedia: string;
  outputPresets: string[];
  generateThumbnails: boolean;
  audioSettings: {
    codec: string;
    bitrate: string;
    sampleRate: number;
  };
}
```

**Resource Requirements**:
- **Instance Type**: standard-2 (2 vCPU, 2GB RAM)
- **Storage**: Streaming-optimized storage
- **Concurrency**: Maximum 4 concurrent jobs per container

### 5. Code Executor Container

**Purpose**: Secure, sandboxed code execution environment

**Capabilities**:
- **Language Support**: JavaScript, Python, Go, Rust
- **Sandbox Security**: Isolated execution with resource limits
- **Package Management**: NPM, pip, go modules support
- **Time Limits**: Configurable execution timeouts
- **Resource Monitoring**: CPU and memory usage tracking
- **Output Capture**: STDOUT, STDERR, and return value capture

**Technical Specifications**:
```typescript
interface CodeExecutionJob {
  language: 'javascript' | 'python' | 'go' | 'rust';
  code: string;
  inputs?: any[];
  timeout: number; // seconds
  memoryLimit: number; // MB
  allowNetworking: boolean;
}
```

**Resource Requirements**:
- **Instance Type**: lite (0.5 vCPU, 512MB RAM)
- **Security**: Strict sandboxing and resource limits
- **Concurrency**: Maximum 10 concurrent jobs per container

## Data Flow and Communication

### Job Lifecycle

```
1. Job Submission
   ↓
2. Queue Routing (by type and priority)
   ↓
3. Container Assignment
   ↓
4. Processing Execution
   ↓
5. Result Storage
   ↓
6. Status Update
   ↓
7. Cleanup and Scaling
```

### Communication Patterns

#### 1. Synchronous Communication
- **HTTP REST API**: Direct communication for immediate processing
- **Health Checks**: Real-time status monitoring
- **Status Queries**: Instant job status retrieval

#### 2. Asynchronous Communication
- **Message Queues**: Priority-based job distribution
- **Event Streaming**: Real-time status updates
- **Webhook Notifications**: Job completion callbacks

#### 3. Data Flow Optimization
- **Edge Caching**: Cloudflare KV for frequently accessed data
- **Connection Pooling**: Optimized database connections
- **Batch Processing**: Efficient bulk job handling

## Integration with Existing Infrastructure

### Cloudflare Workers Integration

The container system seamlessly integrates with the existing Pitchey infrastructure:

```typescript
// Container orchestrator integration in worker
export class ContainerOrchestrator {
  async submitJob(job: ContainerJob): Promise<string> {
    // Store in PostgreSQL for persistence
    const db = this.dbManager.getConnection('write');
    await db`INSERT INTO container_jobs ...`;
    
    // Queue for processing
    await this.queueJob(job);
    
    // Cache status in KV for fast access
    await this.env.JOB_STATUS_KV.put(
      `job:${jobId}`, 
      JSON.stringify({ status: 'pending' }),
      { expirationTtl: 86400 }
    );
    
    return jobId;
  }
}
```

### Database Schema Integration

The container system extends the existing PostgreSQL schema with comprehensive tracking:

- **container_jobs**: Complete job lifecycle tracking
- **container_instances**: Container health and resource monitoring
- **container_metrics**: Time-series performance data
- **container_costs**: Detailed cost tracking and budgeting
- **container_scaling_events**: Auto-scaling decision audit trail

### Authentication Integration

Container services integrate with the existing Better Auth system:

- **Session-based Authentication**: Unified auth across all services
- **Role-based Access Control**: Granular permissions for container operations
- **Organization Isolation**: Multi-tenant container resource isolation

## Scalability and Performance

### Auto-Scaling Architecture

The system implements intelligent auto-scaling based on multiple metrics:

#### 1. Queue Depth Scaling
```typescript
async autoScale(): Promise<void> {
  const queueDepths = await this.getQueueDepths();
  
  for (const [queueType, depth] of Object.entries(queueDepths)) {
    if (depth > 100) {
      await this.scaleUpContainer(queueType);
    } else if (depth < 10) {
      await this.scaleDownContainer(queueType);
    }
  }
}
```

#### 2. Resource-based Scaling
- **CPU Threshold**: Scale up when average CPU > 80%
- **Memory Threshold**: Scale up when average memory > 85%
- **Response Time**: Scale up when average response time > 30s

#### 3. Scale-to-Zero Optimization
```typescript
// Automatic idle detection
protected resetSleepTimer(): void {
  this.sleepTimer = setTimeout(async () => {
    if (this.status === 'running' && this.jobs.size === 0) {
      await this.stop(); // Scale to zero
    }
  }, this.config.sleepAfter * 1000);
}
```

### Performance Characteristics

| Container Service | Startup Time | Processing Time | Memory Usage | Cost per Hour |
|-------------------|---------------|-----------------|--------------|---------------|
| Video Processor   | 15-30s       | 2-10min        | 1.5-2GB      | $0.144        |
| Document Processor| 5-10s        | 10-60s         | 512MB-1GB    | $0.072        |
| AI Inference      | 30-60s       | 5-300s         | 4-8GB        | $0.288        |
| Media Transcoder  | 10-20s       | 1-5min         | 1-1.5GB      | $0.144        |
| Code Executor     | 2-5s         | 1-30s          | 256-512MB    | $0.036        |

### Optimization Strategies

#### 1. Container Warmth Management
- **Pre-warming**: Keep containers warm during peak hours
- **Predictive Scaling**: Scale based on historical patterns
- **Batch Processing**: Group similar jobs to reduce overhead

#### 2. Resource Optimization
- **Memory Pooling**: Reuse memory allocations across jobs
- **Disk Optimization**: Use memory-mapped files for large datasets
- **Network Optimization**: Connection pooling and keep-alive

#### 3. Cost Optimization
- **Spot Instances**: Use lower-cost instances when available
- **Regional Optimization**: Route jobs to lowest-cost regions
- **Time-based Scheduling**: Process non-urgent jobs during off-peak hours

## High-Level System Diagrams

### System Architecture Diagram

```
                                    Pitchey Container Infrastructure
    
    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                                     Edge Layer                                           │
    │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                      │
    │  │   Cloudflare    │    │   Cloudflare    │    │   Cloudflare    │                      │
    │  │   Pages (UI)    │    │  Workers (API)  │    │    R2 Storage   │                      │
    │  └─────────────────┘    └─────────────────┘    └─────────────────┘                      │
    └─────────────────────────────────────────────────────────────────────────────────────────┘
                │                        │                        │
                │                        │                        │
    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                               Orchestration Layer                                        │
    │                                                                                           │
    │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                      │
    │  │  Job Queue      │    │  Container      │    │   Monitoring    │                      │
    │  │  Management     │    │  Orchestrator   │    │   & Metrics     │                      │
    │  │                 │    │                 │    │                 │                      │
    │  │ • Priority      │◄──►│ • Health Checks │◄──►│ • Performance   │                      │
    │  │ • Dead Letter   │    │ • Auto Scaling  │    │ • Cost Tracking │                      │
    │  │ • Retry Logic   │    │ • Load Balance  │    │ • Alerting      │                      │
    │  └─────────────────┘    └─────────────────┘    └─────────────────┘                      │
    └─────────────────────────────────────────────────────────────────────────────────────────┘
                │                        │                        │
                │                        │                        │
    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                              Processing Layer                                             │
    │                                                                                           │
    │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
    │  │   Video     │ │  Document   │ │     AI      │ │   Media     │ │    Code     │        │
    │  │ Processing  │ │ Processing  │ │ Inference   │ │ Transcoding │ │ Execution   │        │
    │  │             │ │             │ │             │ │             │ │             │        │
    │  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │        │
    │  │ │FFmpeg   │ │ │ │PDF OCR  │ │ │ │TF/PyTrch│ │ │ │Audio Enc│ │ │ │JS/Py/Go │ │        │
    │  │ │Transcode│ │ │ │Text Ext │ │ │ │ML Models│ │ │ │Streaming│ │ │ │Sandbox  │ │        │
    │  │ │Thumbnail│ │ │ │Preview  │ │ │ │Analysis │ │ │ │Optimize │ │ │ │Resource │ │        │
    │  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │ │ │Limits   │ │        │
    │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │ └─────────┘ │        │
    │                                                                  └─────────────┘        │
    └─────────────────────────────────────────────────────────────────────────────────────────┘
                │                        │                        │
                │                        │                        │
    ┌─────────────────────────────────────────────────────────────────────────────────────────┐
    │                                Storage Layer                                              │
    │                                                                                           │
    │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                      │
    │  │   PostgreSQL    │    │   Cloudflare    │    │    Upstash      │                      │
    │  │   (Database)    │    │      KV         │    │     Redis       │                      │
    │  │                 │    │                 │    │                 │                      │
    │  │ • Job Tracking  │    │ • Job Status    │    │ • Session Cache │                      │
    │  │ • Metrics       │    │ • Temp Data     │    │ • Real-time     │                      │
    │  │ • Audit Logs    │    │ • Config Cache  │    │ • WebSockets    │                      │
    │  └─────────────────┘    └─────────────────┘    └─────────────────┘                      │
    └─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Container Lifecycle Flow

```
┌─────────────────┐
│  Job Submitted  │
│  via API        │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Queue Router    │
│ • Determine type│
│ • Set priority  │
│ • Store in DB   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    No      ┌─────────────────┐
│ Container       │──────────► │ Start New       │
│ Available?      │            │ Container       │
└─────────┬───────┘            └─────────┬───────┘
          │ Yes                          │
          ▼                              ▼
┌─────────────────┐                      │
│ Assign Job      │◄─────────────────────┘
│ to Container    │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Process Job     │
│ • Execute task  │
│ • Monitor       │
│ • Update status │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    Error    ┌─────────────────┐
│ Job Complete?   │─────────────►│ Retry Logic     │
└─────────┬───────┘              │ • DLQ handling  │
          │ Success              │ • Error logging │
          ▼                      └─────────────────┘
┌─────────────────┐
│ Store Results   │
│ • Update DB     │
│ • Cache status  │
│ • Notify client │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    Idle     ┌─────────────────┐
│ Container Idle? │─────────────►│ Scale to Zero   │
└─────────────────┘              │ after timeout  │
                                 └─────────────────┘
```

This architecture provides a robust, scalable, and cost-effective foundation for Pitchey's containerized processing needs, enabling the platform to handle diverse workloads while maintaining optimal performance and cost efficiency.