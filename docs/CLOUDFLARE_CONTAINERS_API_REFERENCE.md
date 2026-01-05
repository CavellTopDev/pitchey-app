# Pitchey Cloudflare Containers API Reference

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Container Orchestrator API](#container-orchestrator-api)
4. [Video Processor API](#video-processor-api)
5. [Document Processor API](#document-processor-api)
6. [AI Inference API](#ai-inference-api)
7. [Media Transcoder API](#media-transcoder-api)
8. [Code Executor API](#code-executor-api)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)
11. [SDKs and Client Libraries](#sdks-and-client-libraries)

## Overview

The Pitchey Cloudflare Containers API provides a comprehensive set of endpoints for managing and interacting with containerized processing services. All services follow RESTful principles and return JSON responses.

### Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://containers.pitchey.com` |
| Staging | `https://staging.containers.pitchey.com` |
| Local | `http://localhost:8080` |

### API Versioning

All APIs use semantic versioning with the format `/api/v{major}`. Current version: `v1`

### Common Headers

```http
Content-Type: application/json
Authorization: Bearer <token>
X-API-Version: v1
X-Request-ID: <unique-request-id>
```

## Authentication

The Container API integrates with Pitchey's Better Auth system for session-based authentication.

### Authentication Methods

#### 1. Session-based Authentication (Recommended)
```http
POST /api/auth/session
Content-Type: application/json

{
  "session_token": "auth_session_token_from_better_auth"
}
```

#### 2. API Key Authentication
```http
Authorization: Bearer api_key_here
```

#### 3. Service-to-Service Authentication
```http
Authorization: Bearer service_token
X-Service-Name: pitchey-worker
```

### Authentication Response

```json
{
  "authenticated": true,
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "660e8400-e29b-41d4-a716-446655440001",
  "permissions": ["container:read", "container:write", "container:admin"],
  "expires_at": "2024-12-31T23:59:59Z"
}
```

## Container Orchestrator API

The orchestrator manages job submission, tracking, and container lifecycle.

### Submit Job

Submit a processing job to the appropriate container service.

```http
POST /api/v1/jobs
```

**Request Body:**
```json
{
  "type": "video-processing",
  "payload": {
    "inputUrl": "https://storage.pitchey.com/video.mp4",
    "outputFormat": "mp4",
    "quality": "high",
    "resolution": "1920x1080"
  },
  "priority": "high",
  "webhook_url": "https://api.pitchey.com/webhooks/job-complete",
  "metadata": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_id": "pitch_123"
  }
}
```

**Response:**
```json
{
  "job_id": "job_660e8400-e29b-41d4-a716-446655440002",
  "status": "pending",
  "type": "video-processing",
  "created_at": "2024-01-04T10:30:00Z",
  "estimated_completion": "2024-01-04T10:35:00Z",
  "priority": "high"
}
```

### Get Job Status

Retrieve the current status and progress of a job.

```http
GET /api/v1/jobs/{job_id}
```

**Response:**
```json
{
  "job_id": "job_660e8400-e29b-41d4-a716-446655440002",
  "status": "processing",
  "type": "video-processing",
  "progress": 65,
  "created_at": "2024-01-04T10:30:00Z",
  "started_at": "2024-01-04T10:31:00Z",
  "estimated_completion": "2024-01-04T10:35:00Z",
  "container_id": "container_770e8400-e29b-41d4-a716-446655440003",
  "metadata": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_id": "pitch_123"
  },
  "current_step": "transcoding",
  "steps_completed": 2,
  "total_steps": 4
}
```

### Cancel Job

Cancel a pending or running job.

```http
DELETE /api/v1/jobs/{job_id}
```

**Response:**
```json
{
  "job_id": "job_660e8400-e29b-41d4-a716-446655440002",
  "status": "cancelled",
  "cancelled_at": "2024-01-04T10:32:00Z"
}
```

### List Jobs

Get a list of jobs with filtering and pagination.

```http
GET /api/v1/jobs?status=processing&type=video-processing&limit=20&offset=0
```

**Query Parameters:**
- `status`: Filter by job status (pending, processing, completed, failed, cancelled)
- `type`: Filter by job type
- `limit`: Number of results per page (default: 20, max: 100)
- `offset`: Pagination offset
- `user_id`: Filter by user ID
- `created_after`: Filter by creation date (ISO 8601)

**Response:**
```json
{
  "jobs": [
    {
      "job_id": "job_660e8400-e29b-41d4-a716-446655440002",
      "status": "processing",
      "type": "video-processing",
      "created_at": "2024-01-04T10:30:00Z",
      "progress": 65
    }
  ],
  "total": 150,
  "limit": 20,
  "offset": 0,
  "has_more": true
}
```

### Get Container Metrics

Retrieve real-time metrics for container performance and costs.

```http
GET /api/v1/metrics
```

**Response:**
```json
{
  "total_jobs": 1250,
  "completed_jobs": 1200,
  "failed_jobs": 50,
  "active_containers": 12,
  "avg_processing_time": 180,
  "success_rate": 96.0,
  "cost_estimate": 24.50,
  "by_type": {
    "video-processing": {
      "total_jobs": 400,
      "avg_processing_time": 300,
      "success_rate": 95.0,
      "cost": 15.20
    },
    "document-processing": {
      "total_jobs": 600,
      "avg_processing_time": 45,
      "success_rate": 98.5,
      "cost": 3.60
    }
  }
}
```

## Video Processor API

Handles video transcoding, thumbnail generation, and media analysis.

### Process Video

Submit a video for processing with various output options.

```http
POST /api/v1/video/process
```

**Request Body:**
```json
{
  "inputUrl": "https://storage.pitchey.com/input/video.mp4",
  "outputFormat": "mp4",
  "quality": "high",
  "resolution": "1920x1080",
  "bitrate": "5000k",
  "framerate": 30,
  "thumbnailTimes": [10, 30, 60, 120],
  "watermark": {
    "text": "© Pitchey 2024",
    "position": "bottom-right",
    "opacity": 0.7
  },
  "webhookUrl": "https://api.pitchey.com/webhooks/video-complete"
}
```

**Response:**
```json
{
  "job_id": "video_880e8400-e29b-41d4-a716-446655440004",
  "status": "pending",
  "estimated_duration": "00:05:30",
  "estimated_completion": "2024-01-04T10:35:00Z",
  "output_urls": {
    "video": "https://storage.pitchey.com/output/video_processed.mp4",
    "thumbnails": [
      "https://storage.pitchey.com/output/thumb_10s.jpg",
      "https://storage.pitchey.com/output/thumb_30s.jpg",
      "https://storage.pitchey.com/output/thumb_60s.jpg",
      "https://storage.pitchey.com/output/thumb_120s.jpg"
    ]
  }
}
```

### Generate Thumbnails

Generate thumbnails from a video at specific timestamps.

```http
POST /api/v1/video/thumbnails
```

**Request Body:**
```json
{
  "inputUrl": "https://storage.pitchey.com/video.mp4",
  "timestamps": [5, 15, 30, 60, 120],
  "width": 320,
  "height": 180,
  "format": "jpg",
  "quality": 85
}
```

**Response:**
```json
{
  "job_id": "thumb_990e8400-e29b-41d4-a716-446655440005",
  "thumbnails": [
    {
      "timestamp": 5,
      "url": "https://storage.pitchey.com/thumbs/thumb_5s.jpg",
      "width": 320,
      "height": 180
    },
    {
      "timestamp": 15,
      "url": "https://storage.pitchey.com/thumbs/thumb_15s.jpg",
      "width": 320,
      "height": 180
    }
  ]
}
```

### Analyze Video

Extract metadata and analyze video content.

```http
POST /api/v1/video/analyze
```

**Request Body:**
```json
{
  "inputUrl": "https://storage.pitchey.com/video.mp4",
  "includeScenes": true,
  "includeAudio": true,
  "includeMetadata": true
}
```

**Response:**
```json
{
  "job_id": "analyze_aa0e8400-e29b-41d4-a716-446655440006",
  "analysis": {
    "duration": 300.5,
    "width": 1920,
    "height": 1080,
    "bitrate": 5000000,
    "framerate": 30.0,
    "codec": "h264",
    "fileSize": 187500000,
    "hasAudio": true,
    "audioCodec": "aac",
    "audioChannels": 2,
    "scenes": [
      {
        "start": 0,
        "end": 45.2,
        "confidence": 0.95
      },
      {
        "start": 45.2,
        "end": 120.8,
        "confidence": 0.87
      }
    ],
    "metadata": {
      "title": "Project Pitch Video",
      "creator": "Pitchey User",
      "creation_date": "2024-01-03T15:30:00Z"
    }
  }
}
```

### Add Watermark

Add text or image watermark to a video.

```http
POST /api/v1/video/watermark
```

**Request Body:**
```json
{
  "inputUrl": "https://storage.pitchey.com/video.mp4",
  "watermark": {
    "type": "text",
    "text": "© Pitchey 2024 - Confidential",
    "position": "bottom-right",
    "opacity": 0.8,
    "fontSize": 24,
    "fontColor": "#FFFFFF",
    "backgroundColor": "#000000",
    "padding": 10
  }
}
```

**Response:**
```json
{
  "job_id": "watermark_bb0e8400-e29b-41d4-a716-446655440007",
  "outputUrl": "https://storage.pitchey.com/output/watermarked_video.mp4",
  "status": "processing",
  "estimated_completion": "2024-01-04T10:38:00Z"
}
```

## Document Processor API

Handles document processing, OCR, text extraction, and format conversion.

### Process Document

Process a document with various output options.

```http
POST /api/v1/document/process
```

**Request Body:**
```json
{
  "documentUrl": "https://storage.pitchey.com/document.pdf",
  "outputFormats": ["text", "html", "markdown", "preview"],
  "ocrEnabled": true,
  "language": "en",
  "extractImages": true,
  "generatePreview": true,
  "preserveFormatting": true
}
```

**Response:**
```json
{
  "job_id": "doc_cc0e8400-e29b-41d4-a716-446655440008",
  "status": "pending",
  "outputs": {
    "text": "https://storage.pitchey.com/output/document.txt",
    "html": "https://storage.pitchey.com/output/document.html",
    "markdown": "https://storage.pitchey.com/output/document.md",
    "preview": "https://storage.pitchey.com/output/document_preview.png"
  },
  "estimated_completion": "2024-01-04T10:32:00Z"
}
```

### Extract Text

Extract text content from a document using OCR.

```http
POST /api/v1/document/extract-text
```

**Request Body:**
```json
{
  "documentUrl": "https://storage.pitchey.com/scanned_document.pdf",
  "language": "en",
  "ocrEngine": "tesseract",
  "confidence": 0.8,
  "preserveLayout": true
}
```

**Response:**
```json
{
  "job_id": "extract_dd0e8400-e29b-41d4-a716-446655440009",
  "extractedText": "This is the extracted text content from the document...",
  "confidence": 0.92,
  "pageCount": 5,
  "wordCount": 1250,
  "language": "en",
  "processing_time": 12.5
}
```

### Generate Preview

Generate preview images for document pages.

```http
POST /api/v1/document/preview
```

**Request Body:**
```json
{
  "documentUrl": "https://storage.pitchey.com/document.pdf",
  "pages": [1, 2, 3],
  "width": 800,
  "height": 1000,
  "format": "png",
  "quality": 90
}
```

**Response:**
```json
{
  "job_id": "preview_ee0e8400-e29b-41d4-a716-446655440010",
  "previews": [
    {
      "page": 1,
      "url": "https://storage.pitchey.com/previews/doc_page_1.png",
      "width": 800,
      "height": 1000
    },
    {
      "page": 2,
      "url": "https://storage.pitchey.com/previews/doc_page_2.png",
      "width": 800,
      "height": 1000
    }
  ]
}
```

## AI Inference API

Handles machine learning model inference and AI-powered analysis.

### Run Inference

Execute AI model inference on provided input data.

```http
POST /api/v1/ai/inference
```

**Request Body:**
```json
{
  "model": "gpt-4-turbo",
  "inputData": {
    "text": "Analyze this movie pitch: A young developer creates an AI that can predict movie success...",
    "context": "movie_pitch_analysis"
  },
  "parameters": {
    "temperature": 0.7,
    "maxTokens": 1000,
    "topP": 0.9
  },
  "outputFormat": "json"
}
```

**Response:**
```json
{
  "job_id": "ai_ff0e8400-e29b-41d4-a716-446655440011",
  "model": "gpt-4-turbo",
  "result": {
    "analysis": {
      "genre": "Sci-Fi Thriller",
      "market_appeal": 8.2,
      "originality": 7.8,
      "commercial_viability": 8.5,
      "strengths": [
        "Timely AI theme",
        "Strong premise",
        "Broad audience appeal"
      ],
      "weaknesses": [
        "Saturated market",
        "Technical complexity"
      ],
      "recommendations": [
        "Focus on human elements",
        "Develop unique AI personality",
        "Consider ensemble cast"
      ]
    }
  },
  "confidence": 0.89,
  "processing_time": 2.3,
  "tokens_used": 750
}
```

### Text Analysis

Analyze text for sentiment, entities, and classification.

```http
POST /api/v1/ai/text-analysis
```

**Request Body:**
```json
{
  "text": "This movie pitch is absolutely brilliant! The concept is innovative and the story arc is compelling.",
  "analysis_types": ["sentiment", "entities", "topics", "keywords"],
  "language": "en"
}
```

**Response:**
```json
{
  "job_id": "text_analysis_gg0e8400-e29b-41d4-a716-446655440012",
  "sentiment": {
    "score": 0.92,
    "label": "positive",
    "confidence": 0.96
  },
  "entities": [
    {
      "text": "movie pitch",
      "type": "CONCEPT",
      "confidence": 0.89
    },
    {
      "text": "story arc",
      "type": "NARRATIVE_ELEMENT",
      "confidence": 0.85
    }
  ],
  "topics": ["entertainment", "creativity", "storytelling"],
  "keywords": ["brilliant", "innovative", "compelling"],
  "language_detected": "en",
  "readability_score": 7.2
}
```

### Image Analysis

Analyze images for objects, content, and moderation.

```http
POST /api/v1/ai/image-analysis
```

**Request Body:**
```json
{
  "imageUrl": "https://storage.pitchey.com/pitch_poster.jpg",
  "analysis_types": ["objects", "faces", "text", "moderation"],
  "confidence_threshold": 0.7
}
```

**Response:**
```json
{
  "job_id": "image_hh0e8400-e29b-41d4-a716-446655440013",
  "objects": [
    {
      "name": "person",
      "confidence": 0.95,
      "bounding_box": [100, 150, 200, 350]
    },
    {
      "name": "movie poster",
      "confidence": 0.87,
      "bounding_box": [0, 0, 400, 600]
    }
  ],
  "faces": [
    {
      "confidence": 0.92,
      "bounding_box": [120, 180, 180, 240],
      "emotions": {
        "happy": 0.75,
        "confident": 0.82
      }
    }
  ],
  "text_detected": "The Next Big Hit - Coming Soon",
  "moderation": {
    "safe": true,
    "adult_content": 0.05,
    "violence": 0.02,
    "inappropriate": 0.01
  }
}
```

## Media Transcoder API

Handles audio and media transcoding for web delivery.

### Transcode Audio

Convert audio to various formats optimized for web delivery.

```http
POST /api/v1/media/transcode-audio
```

**Request Body:**
```json
{
  "inputUrl": "https://storage.pitchey.com/audio.wav",
  "outputFormats": ["mp3", "aac", "ogg"],
  "quality": "high",
  "bitrate": "320k",
  "sampleRate": 44100,
  "normalize": true,
  "removeNoise": true
}
```

**Response:**
```json
{
  "job_id": "audio_ii0e8400-e29b-41d4-a716-446655440014",
  "outputs": {
    "mp3": {
      "url": "https://storage.pitchey.com/output/audio.mp3",
      "bitrate": "320k",
      "size": 8500000
    },
    "aac": {
      "url": "https://storage.pitchey.com/output/audio.aac",
      "bitrate": "320k",
      "size": 7800000
    },
    "ogg": {
      "url": "https://storage.pitchey.com/output/audio.ogg",
      "bitrate": "320k",
      "size": 7200000
    }
  },
  "metadata": {
    "duration": 210.5,
    "original_format": "wav",
    "channels": 2,
    "sample_rate": 44100
  }
}
```

### Generate Streaming Manifest

Create HLS and DASH manifests for adaptive streaming.

```http
POST /api/v1/media/streaming
```

**Request Body:**
```json
{
  "inputUrl": "https://storage.pitchey.com/video.mp4",
  "formats": ["hls", "dash"],
  "resolutions": ["720p", "1080p", "1440p"],
  "bitrates": ["2000k", "5000k", "8000k"],
  "segmentDuration": 6
}
```

**Response:**
```json
{
  "job_id": "streaming_jj0e8400-e29b-41d4-a716-446655440015",
  "manifests": {
    "hls": {
      "master_playlist": "https://storage.pitchey.com/streaming/master.m3u8",
      "variants": [
        {
          "resolution": "720p",
          "bitrate": "2000k",
          "playlist": "https://storage.pitchey.com/streaming/720p.m3u8"
        },
        {
          "resolution": "1080p",
          "bitrate": "5000k",
          "playlist": "https://storage.pitchey.com/streaming/1080p.m3u8"
        }
      ]
    },
    "dash": {
      "manifest": "https://storage.pitchey.com/streaming/manifest.mpd"
    }
  },
  "estimated_completion": "2024-01-04T10:45:00Z"
}
```

### Optimize Media

Optimize media files for web delivery and CDN distribution.

```http
POST /api/v1/media/optimize
```

**Request Body:**
```json
{
  "inputUrl": "https://storage.pitchey.com/large_video.mp4",
  "targetFileSize": "50MB",
  "maintainQuality": true,
  "optimizeFor": "web",
  "enableFastStart": true
}
```

**Response:**
```json
{
  "job_id": "optimize_kk0e8400-e29b-41d4-a716-446655440016",
  "optimized": {
    "url": "https://storage.pitchey.com/output/optimized_video.mp4",
    "original_size": 157000000,
    "optimized_size": 52000000,
    "compression_ratio": 0.67,
    "quality_score": 0.91
  },
  "settings_used": {
    "codec": "h264",
    "bitrate": "3500k",
    "resolution": "1920x1080",
    "fps": 30
  }
}
```

## Code Executor API

Provides secure, sandboxed code execution environment.

### Execute Code

Execute code in a secure sandboxed environment.

```http
POST /api/v1/code/execute
```

**Request Body:**
```json
{
  "language": "python",
  "code": "import json\n\ndef analyze_pitch(data):\n    score = len(data.get('description', '')) * 0.1\n    return {'score': min(score, 10)}\n\nresult = analyze_pitch({'description': 'An innovative movie about AI'})\nprint(json.dumps(result))",
  "inputs": [
    {"description": "An innovative movie about AI"}
  ],
  "timeout": 30,
  "memoryLimit": 256,
  "allowNetworking": false,
  "packages": ["json"]
}
```

**Response:**
```json
{
  "job_id": "code_ll0e8400-e29b-41d4-a716-446655440017",
  "result": {
    "stdout": "{\"score\": 3.3}\n",
    "stderr": "",
    "exit_code": 0,
    "execution_time": 0.245,
    "memory_used": 12.5
  },
  "language": "python",
  "status": "completed"
}
```

### Supported Languages

Get list of supported programming languages and their configurations.

```http
GET /api/v1/code/languages
```

**Response:**
```json
{
  "languages": [
    {
      "name": "python",
      "version": "3.11.0",
      "available_packages": ["numpy", "pandas", "requests", "json", "datetime"],
      "max_execution_time": 300,
      "max_memory_mb": 512
    },
    {
      "name": "javascript",
      "version": "18.17.0",
      "available_packages": ["lodash", "moment", "axios"],
      "max_execution_time": 60,
      "max_memory_mb": 256
    },
    {
      "name": "go",
      "version": "1.21.0",
      "available_packages": ["fmt", "json", "net/http"],
      "max_execution_time": 120,
      "max_memory_mb": 256
    }
  ]
}
```

### Code Templates

Get pre-built code templates for common tasks.

```http
GET /api/v1/code/templates?language=python&category=data_analysis
```

**Response:**
```json
{
  "templates": [
    {
      "id": "pitch_analyzer",
      "name": "Movie Pitch Analyzer",
      "description": "Analyze movie pitch data and provide scoring",
      "language": "python",
      "code": "import json\n\ndef analyze_pitch(pitch_data):\n    # Analyze various aspects of the pitch\n    genre_score = calculate_genre_appeal(pitch_data.get('genre'))\n    length_score = calculate_length_score(pitch_data.get('description'))\n    \n    return {\n        'total_score': (genre_score + length_score) / 2,\n        'genre_score': genre_score,\n        'length_score': length_score\n    }\n\n# Your implementation here",
      "inputs_schema": {
        "type": "object",
        "properties": {
          "genre": {"type": "string"},
          "description": {"type": "string"}
        }
      }
    }
  ]
}
```

## Error Handling

### Standard Error Response Format

All API endpoints return errors in a consistent format:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "The provided input URL is not accessible",
    "details": {
      "field": "inputUrl",
      "reason": "URL returned 404 Not Found",
      "url": "https://storage.pitchey.com/nonexistent.mp4"
    },
    "request_id": "req_mm0e8400-e29b-41d4-a716-446655440018",
    "timestamp": "2024-01-04T10:30:00Z"
  }
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_INPUT` | Invalid input parameters | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMITED` | Rate limit exceeded | 429 |
| `INTERNAL_ERROR` | Server-side error | 500 |
| `SERVICE_UNAVAILABLE` | Container service unavailable | 503 |
| `TIMEOUT` | Processing timeout | 504 |

### Container-Specific Error Codes

| Code | Service | Description |
|------|---------|-------------|
| `VIDEO_FORMAT_UNSUPPORTED` | Video | Unsupported video format |
| `VIDEO_TOO_LARGE` | Video | Video file exceeds size limit |
| `DOCUMENT_CORRUPTED` | Document | Document file is corrupted |
| `OCR_FAILED` | Document | OCR processing failed |
| `MODEL_NOT_AVAILABLE` | AI | Requested AI model not available |
| `INFERENCE_FAILED` | AI | AI inference processing failed |
| `AUDIO_FORMAT_INVALID` | Media | Invalid audio format |
| `TRANSCODING_FAILED` | Media | Media transcoding failed |
| `CODE_COMPILATION_ERROR` | Code | Code compilation failed |
| `CODE_RUNTIME_ERROR` | Code | Runtime error during execution |
| `EXECUTION_TIMEOUT` | Code | Code execution timed out |

### Retry Guidelines

For transient errors, implement exponential backoff:

```javascript
async function retryRequest(requestFn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      if (error.status === 429 || error.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Don't retry client errors
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Rate Limiting

### Rate Limit Headers

All responses include rate limiting information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704369600
X-RateLimit-Window: 3600
```

### Rate Limits by Service

| Service | Requests per Hour | Burst Limit |
|---------|-------------------|-------------|
| Orchestrator | 1000 | 50 |
| Video Processor | 100 | 10 |
| Document Processor | 500 | 25 |
| AI Inference | 200 | 10 |
| Media Transcoder | 300 | 15 |
| Code Executor | 1000 | 100 |

### Rate Limit Exceeded Response

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Limit: 1000 requests per hour",
    "retry_after": 3600,
    "current_usage": 1000,
    "limit": 1000,
    "window": 3600
  }
}
```

## SDKs and Client Libraries

### JavaScript/TypeScript SDK

```bash
npm install @pitchey/containers-sdk
```

```typescript
import { ContainersClient } from '@pitchey/containers-sdk';

const client = new ContainersClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://containers.pitchey.com'
});

// Submit video processing job
const videoJob = await client.video.process({
  inputUrl: 'https://storage.example.com/video.mp4',
  outputFormat: 'mp4',
  quality: 'high'
});

// Wait for completion
const result = await client.jobs.waitForCompletion(videoJob.job_id);
console.log('Processing complete:', result);
```

### Python SDK

```bash
pip install pitchey-containers
```

```python
from pitchey_containers import ContainersClient

client = ContainersClient(
    api_key='your-api-key',
    base_url='https://containers.pitchey.com'
)

# Submit document processing job
doc_job = client.document.process(
    document_url='https://storage.example.com/doc.pdf',
    output_formats=['text', 'html'],
    ocr_enabled=True
)

# Poll for completion
result = client.jobs.wait_for_completion(doc_job['job_id'])
print(f"Processing complete: {result}")
```

### Go SDK

```go
package main

import (
    "context"
    "github.com/pitchey/containers-go-sdk"
)

func main() {
    client := containers.NewClient("your-api-key", "https://containers.pitchey.com")
    
    // Submit AI inference job
    job, err := client.AI.Inference(context.Background(), &containers.InferenceRequest{
        Model: "gpt-4-turbo",
        InputData: map[string]interface{}{
            "text": "Analyze this movie pitch...",
        },
        Parameters: map[string]interface{}{
            "temperature": 0.7,
            "maxTokens":   1000,
        },
    })
    if err != nil {
        panic(err)
    }
    
    // Wait for result
    result, err := client.Jobs.WaitForCompletion(context.Background(), job.JobID)
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Analysis complete: %+v\n", result)
}
```

### Webhook Integration

Set up webhooks to receive notifications when jobs complete:

```javascript
// Express.js webhook handler
app.post('/webhooks/container-job-complete', (req, res) => {
  const { job_id, status, result, error } = req.body;
  
  if (status === 'completed') {
    console.log(`Job ${job_id} completed successfully:`, result);
    // Process the result
  } else if (status === 'failed') {
    console.error(`Job ${job_id} failed:`, error);
    // Handle the error
  }
  
  res.status(200).send('OK');
});
```

### Error Handling Best Practices

```typescript
import { ContainersClient, ContainerError } from '@pitchey/containers-sdk';

try {
  const result = await client.video.process(videoConfig);
} catch (error) {
  if (error instanceof ContainerError) {
    switch (error.code) {
      case 'RATE_LIMITED':
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
        break;
      case 'VIDEO_TOO_LARGE':
        // Reduce video size or quality
        break;
      default:
        console.error('Container processing failed:', error.message);
    }
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

This comprehensive API reference provides complete documentation for all container services with real-world examples, proper error handling, and SDK integration guidelines. The consistent API design ensures easy integration and maintenance across all services.