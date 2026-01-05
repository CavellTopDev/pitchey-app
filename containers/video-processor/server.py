"""
Video Processing Container Server
Handles video transcoding, thumbnail generation, compression, and analysis.
"""
import os
import sys
import asyncio
import logging
import tempfile
import shutil
import uuid
import ffmpeg
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

# Add shared utilities to path
sys.path.append('/app/shared')

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from health import HealthChecker
from security import SecurityManager, require_auth, ResourceLimiter
from utils import FileManager, ProcessingQueue, setup_logging, ConfigManager

# Initialize services
setup_logging('video-processor')
logger = logging.getLogger(__name__)
config = ConfigManager('video-processor')
health_checker = HealthChecker('video-processor')
security_manager = SecurityManager()
resource_limiter = ResourceLimiter()
file_manager = FileManager()
processing_queue = ProcessingQueue(max_concurrent=config.get('max_workers', 3))

# FastAPI app
app = FastAPI(
    title="Pitchey Video Processor",
    description="Container service for video processing, transcoding, and analysis",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoProcessor:
    """Handles video processing operations."""
    
    def __init__(self):
        self.supported_formats = {
            'input': ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'],
            'output': ['.mp4', '.webm', '.mov', '.avi']
        }
        
    async def get_video_info(self, file_path: str) -> Dict[str, Any]:
        """Extract video metadata and information."""
        try:
            probe = ffmpeg.probe(file_path)
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            audio_info = next((s for s in probe['streams'] if s['codec_type'] == 'audio'), None)
            
            duration = float(probe['format']['duration'])
            size = int(probe['format']['size'])
            
            return {
                'duration': duration,
                'width': int(video_info['width']),
                'height': int(video_info['height']),
                'framerate': eval(video_info['r_frame_rate']),
                'codec': video_info['codec_name'],
                'bitrate': int(probe['format'].get('bit_rate', 0)),
                'size_bytes': size,
                'audio_codec': audio_info['codec_name'] if audio_info else None,
                'format': probe['format']['format_name']
            }
        except Exception as e:
            logger.error(f"Error getting video info: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid video file: {e}")
            
    async def generate_thumbnail(self, input_path: str, output_path: str, 
                               timestamp: float = 5.0, width: int = 320, height: int = 240) -> str:
        """Generate video thumbnail at specified timestamp."""
        try:
            (
                ffmpeg
                .input(input_path, ss=timestamp)
                .output(output_path, vframes=1, s=f'{width}x{height}', format='image2')
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            return output_path
        except ffmpeg.Error as e:
            logger.error(f"Thumbnail generation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Thumbnail generation failed: {e}")
            
    async def transcode_video(self, input_path: str, output_path: str,
                            format: str = 'mp4', quality: str = 'medium',
                            resolution: Optional[str] = None) -> str:
        """Transcode video to different format/quality."""
        
        # Quality presets
        quality_settings = {
            'low': {'crf': 28, 'preset': 'fast'},
            'medium': {'crf': 23, 'preset': 'medium'}, 
            'high': {'crf': 18, 'preset': 'slow'},
            'ultra': {'crf': 15, 'preset': 'veryslow'}
        }
        
        settings = quality_settings.get(quality, quality_settings['medium'])
        
        try:
            stream = ffmpeg.input(input_path)
            
            # Video encoding parameters
            video_params = {
                'c:v': 'libx264',
                'crf': settings['crf'],
                'preset': settings['preset'],
                'pix_fmt': 'yuv420p'
            }
            
            # Apply resolution if specified
            if resolution:
                video_params['s'] = resolution
                
            # Audio encoding
            audio_params = {'c:a': 'aac', 'b:a': '128k'}
            
            # Output format specific settings
            if format == 'webm':
                video_params['c:v'] = 'libvpx-vp9'
                audio_params['c:a'] = 'libvorbis'
            elif format == 'mov':
                video_params['movflags'] = 'faststart'
                
            (
                stream
                .output(output_path, **video_params, **audio_params, format=format)
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            
            return output_path
            
        except ffmpeg.Error as e:
            logger.error(f"Video transcoding failed: {e}")
            raise HTTPException(status_code=500, detail=f"Transcoding failed: {e}")
            
    async def compress_video(self, input_path: str, output_path: str,
                           target_size_mb: Optional[int] = None,
                           compression_level: str = 'medium') -> str:
        """Compress video with size or quality constraints."""
        
        try:
            # Get video duration for bitrate calculation
            info = await self.get_video_info(input_path)
            duration = info['duration']
            
            # Calculate target bitrate if size constraint is given
            if target_size_mb:
                target_bitrate = int((target_size_mb * 8 * 1024 * 1024) / duration * 0.95)  # 95% for audio
                video_bitrate = max(target_bitrate - 128000, 100000)  # Reserve 128k for audio
            else:
                # Use compression level presets
                level_settings = {
                    'light': 0.8,
                    'medium': 0.6,
                    'heavy': 0.4,
                    'extreme': 0.2
                }
                factor = level_settings.get(compression_level, 0.6)
                video_bitrate = int(info.get('bitrate', 2000000) * factor)
            
            (
                ffmpeg
                .input(input_path)
                .output(
                    output_path,
                    **{
                        'c:v': 'libx264',
                        'b:v': video_bitrate,
                        'c:a': 'aac',
                        'b:a': '128k',
                        'preset': 'medium',
                        'movflags': 'faststart'
                    }
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            
            return output_path
            
        except ffmpeg.Error as e:
            logger.error(f"Video compression failed: {e}")
            raise HTTPException(status_code=500, detail=f"Compression failed: {e}")

# Initialize video processor
video_processor = VideoProcessor()

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup."""
    logger.info("Video Processor starting up...")
    
    # Verify FFmpeg installation
    try:
        ffmpeg.probe('/dev/null')
    except:
        pass  # Expected to fail, just checking if FFmpeg is available
    
    health_checker.mark_ready()
    logger.info("Video Processor ready to accept requests")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Video Processor shutting down...")
    file_manager.cleanup()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return health_checker.get_health_status()

@app.get("/ready")
async def readiness_check():
    """Readiness probe endpoint."""
    return health_checker.get_readiness_status()

@app.get("/queue/status")
@require_auth(security_manager)
async def queue_status():
    """Get processing queue status."""
    return processing_queue.get_queue_stats()

@app.post("/process")
@require_auth(security_manager)
async def process_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    operation: str = Form(...),  # transcode, compress, analyze
    format: Optional[str] = Form('mp4'),
    quality: Optional[str] = Form('medium'),
    resolution: Optional[str] = Form(None),
    target_size_mb: Optional[int] = Form(None)
):
    """Main video processing endpoint."""
    
    # Validate file
    file_content = await file.read()
    is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Generate task ID and save file
    task_id = str(uuid.uuid4())
    input_path = await file_manager.save_uploaded_file(file_content, file.filename)
    
    # Validate video format
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in video_processor.supported_formats['input']:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported video format: {file_ext}"
        )
    
    async def process_task():
        """Background processing task."""
        try:
            output_filename = f"processed_{task_id}.{format}"
            output_path = os.path.join(file_manager.temp_dir, output_filename)
            
            if operation == 'transcode':
                result_path = await video_processor.transcode_video(
                    input_path, output_path, format, quality, resolution
                )
            elif operation == 'compress':
                result_path = await video_processor.compress_video(
                    input_path, output_path, target_size_mb, quality
                )
            elif operation == 'analyze':
                return await video_processor.get_video_info(input_path)
            else:
                raise HTTPException(status_code=400, detail=f"Unknown operation: {operation}")
            
            # Get output file info
            output_size = os.path.getsize(result_path)
            
            return {
                'task_id': task_id,
                'status': 'completed',
                'operation': operation,
                'input_file': file.filename,
                'output_file': output_filename,
                'output_size': output_size,
                'download_url': f'/download/{task_id}'
            }
            
        except Exception as e:
            logger.error(f"Processing task {task_id} failed: {e}")
            raise
    
    # Add to processing queue
    await processing_queue.add_task(task_id, process_task())
    
    return {
        'task_id': task_id,
        'status': 'processing',
        'message': 'Video processing started',
        'check_status_url': f'/status/{task_id}'
    }

@app.post("/thumbnail")
@require_auth(security_manager)
async def generate_video_thumbnail(
    file: UploadFile = File(...),
    timestamp: float = Query(5.0, description="Timestamp in seconds"),
    width: int = Query(320),
    height: int = Query(240)
):
    """Generate video thumbnail."""
    
    # Validate and save file
    file_content = await file.read()
    is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    input_path = await file_manager.save_uploaded_file(file_content, file.filename)
    
    try:
        # Generate unique filename for thumbnail
        thumb_id = str(uuid.uuid4())
        output_path = os.path.join(file_manager.temp_dir, f"thumb_{thumb_id}.jpg")
        
        await video_processor.generate_thumbnail(input_path, output_path, timestamp, width, height)
        
        return FileResponse(
            output_path,
            media_type="image/jpeg",
            filename=f"thumbnail_{file.filename}.jpg"
        )
        
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
@require_auth(security_manager)
async def analyze_video(file: UploadFile = File(...)):
    """Analyze video and return metadata."""
    
    # Validate and save file
    file_content = await file.read()
    is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    input_path = await file_manager.save_uploaded_file(file_content, file.filename)
    
    try:
        info = await video_processor.get_video_info(input_path)
        return {
            'filename': file.filename,
            'analysis': info,
            'supported_operations': ['transcode', 'compress', 'thumbnail'],
            'supported_formats': video_processor.supported_formats
        }
    except Exception as e:
        logger.error(f"Video analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
@require_auth(security_manager)
async def get_task_status(task_id: str):
    """Get processing task status."""
    status = processing_queue.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return status

@app.get("/download/{task_id}")
@require_auth(security_manager)
async def download_processed_file(task_id: str):
    """Download processed video file."""
    
    # Find the output file for this task
    task_status = processing_queue.get_task_status(task_id)
    if not task_status or task_status['status'] != 'completed':
        raise HTTPException(status_code=404, detail="Processed file not found or task not completed")
    
    result = task_status.get('result', {})
    output_filename = result.get('output_file')
    if not output_filename:
        raise HTTPException(status_code=404, detail="Output file not available")
    
    output_path = os.path.join(file_manager.temp_dir, output_filename)
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Output file no longer available")
    
    return FileResponse(
        output_path,
        filename=output_filename
    )

@app.get("/formats")
async def get_supported_formats():
    """Get supported video formats."""
    return video_processor.supported_formats

if __name__ == "__main__":
    port = config.get('port', 8080)
    debug = config.get('debug', False)
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        log_level="debug" if debug else "info",
        reload=debug
    )