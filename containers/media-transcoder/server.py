"""
Media Transcoder Container Server
Handles advanced media transcoding for adaptive streaming (HLS, DASH),
live streaming, and multi-bitrate encoding.
"""
import os
import sys
import asyncio
import logging
import tempfile
import shutil
import uuid
import subprocess
import json
from datetime import datetime
from typing import Optional, Dict, Any, List, Union
from pathlib import Path
import ffmpeg
import m3u8

# Add shared utilities to path
sys.path.append('/app/shared')

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Query, Request
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

from health import HealthChecker
from security import SecurityManager, require_auth, ResourceLimiter
from utils import FileManager, ProcessingQueue, setup_logging, ConfigManager

# Initialize services
setup_logging('media-transcoder')
logger = logging.getLogger(__name__)
config = ConfigManager('media-transcoder')
health_checker = HealthChecker('media-transcoder')
security_manager = SecurityManager()
resource_limiter = ResourceLimiter()
file_manager = FileManager()
processing_queue = ProcessingQueue(max_concurrent=config.get('max_workers', 2))

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# FastAPI app
app = FastAPI(
    title="Pitchey Media Transcoder",
    description="Container service for adaptive streaming, HLS/DASH transcoding, and live streaming",
    version="1.0.0"
)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for serving streaming content
app.mount("/streams", StaticFiles(directory="/app/streams"), name="streams")

class MediaTranscoder:
    """Handles advanced media transcoding and streaming operations."""
    
    def __init__(self):
        self.output_dir = Path('/app/streams')
        self.manifests_dir = Path('/app/manifests')
        self.supported_formats = {
            'input': ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'],
            'streaming': ['hls', 'dash', 'smooth']
        }
        
        # Quality presets for adaptive streaming
        self.quality_presets = {
            'mobile': {
                'resolution': '426x240',
                'bitrate': '400k',
                'audio_bitrate': '64k',
                'framerate': 30
            },
            'low': {
                'resolution': '854x480',
                'bitrate': '800k',
                'audio_bitrate': '96k',
                'framerate': 30
            },
            'medium': {
                'resolution': '1280x720',
                'bitrate': '1400k',
                'audio_bitrate': '128k',
                'framerate': 30
            },
            'high': {
                'resolution': '1920x1080',
                'bitrate': '2800k',
                'audio_bitrate': '160k',
                'framerate': 30
            },
            'ultra': {
                'resolution': '1920x1080',
                'bitrate': '5000k',
                'audio_bitrate': '192k',
                'framerate': 60
            }
        }
        
    async def analyze_media(self, file_path: str) -> Dict[str, Any]:
        """Analyze media file for optimal transcoding settings."""
        try:
            probe = ffmpeg.probe(file_path)
            
            # Extract video stream info
            video_stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')
            audio_streams = [s for s in probe['streams'] if s['codec_type'] == 'audio']
            
            duration = float(probe['format']['duration'])
            size = int(probe['format']['size'])
            
            analysis = {
                'duration': duration,
                'size_bytes': size,
                'format': probe['format']['format_name'],
                'video': {
                    'codec': video_stream['codec_name'],
                    'width': int(video_stream['width']),
                    'height': int(video_stream['height']),
                    'framerate': eval(video_stream['r_frame_rate']),
                    'bitrate': int(video_stream.get('bit_rate', 0)),
                    'pixel_format': video_stream.get('pix_fmt')
                },
                'audio': []
            }
            
            for audio_stream in audio_streams:
                analysis['audio'].append({
                    'codec': audio_stream['codec_name'],
                    'channels': int(audio_stream.get('channels', 0)),
                    'sample_rate': int(audio_stream.get('sample_rate', 0)),
                    'bitrate': int(audio_stream.get('bit_rate', 0))
                })
            
            # Recommend quality levels based on input resolution
            input_height = analysis['video']['height']
            recommended_qualities = []
            
            if input_height >= 1080:
                recommended_qualities = ['mobile', 'low', 'medium', 'high', 'ultra']
            elif input_height >= 720:
                recommended_qualities = ['mobile', 'low', 'medium', 'high']
            elif input_height >= 480:
                recommended_qualities = ['mobile', 'low', 'medium']
            else:
                recommended_qualities = ['mobile', 'low']
            
            analysis['recommended_qualities'] = recommended_qualities
            
            return analysis
            
        except Exception as e:
            logger.error(f"Media analysis failed: {e}")
            raise HTTPException(status_code=400, detail=f"Media analysis failed: {e}")
    
    async def create_hls_stream(self, input_path: str, output_name: str, 
                              qualities: List[str] = None) -> Dict[str, Any]:
        """Create HLS adaptive bitrate stream."""
        try:
            if not qualities:
                qualities = ['mobile', 'low', 'medium', 'high']
            
            output_dir = self.output_dir / output_name
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Create variant playlists for each quality
            variant_info = []
            
            for quality in qualities:
                if quality not in self.quality_presets:
                    continue
                    
                preset = self.quality_presets[quality]
                variant_name = f"{quality}_{preset['resolution'].replace('x', 'p')}"
                variant_dir = output_dir / variant_name
                variant_dir.mkdir(exist_ok=True)
                
                # Generate HLS segments for this quality
                output_file = variant_dir / "playlist.m3u8"
                segment_pattern = variant_dir / "segment_%03d.ts"
                
                (
                    ffmpeg
                    .input(input_path)
                    .output(
                        str(segment_pattern),
                        format='hls',
                        vcodec='libx264',
                        acodec='aac',
                        s=preset['resolution'],
                        b=preset['bitrate'],
                        ab=preset['audio_bitrate'],
                        r=preset['framerate'],
                        hls_time=6,  # 6 second segments
                        hls_playlist_type='vod',
                        hls_segment_filename=str(segment_pattern)
                    )
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
                
                # Update playlist with correct path
                playlist_path = str(output_file)
                
                variant_info.append({
                    'quality': quality,
                    'resolution': preset['resolution'],
                    'bandwidth': self._calculate_bandwidth(preset['bitrate'], preset['audio_bitrate']),
                    'playlist': f"/streams/{output_name}/{variant_name}/playlist.m3u8",
                    'codecs': 'avc1.42e00a,mp4a.40.2'
                })
            
            # Create master playlist
            master_playlist = self._create_master_playlist(variant_info)
            master_path = output_dir / "master.m3u8"
            
            with open(master_path, 'w') as f:
                f.write(master_playlist)
            
            return {
                'stream_id': output_name,
                'format': 'hls',
                'master_playlist': f"/streams/{output_name}/master.m3u8",
                'variants': variant_info,
                'total_variants': len(variant_info),
                'status': 'ready'
            }
            
        except ffmpeg.Error as e:
            logger.error(f"HLS creation failed: {e}")
            raise HTTPException(status_code=500, detail=f"HLS creation failed: {e}")
    
    async def create_dash_stream(self, input_path: str, output_name: str,
                               qualities: List[str] = None) -> Dict[str, Any]:
        """Create DASH adaptive bitrate stream."""
        try:
            if not qualities:
                qualities = ['mobile', 'low', 'medium', 'high']
            
            output_dir = self.output_dir / output_name
            output_dir.mkdir(parents=True, exist_ok=True)
            
            # Create representations for each quality
            representations = []
            
            for i, quality in enumerate(qualities):
                if quality not in self.quality_presets:
                    continue
                    
                preset = self.quality_presets[quality]
                repr_id = f"video_{i}"
                
                # Create video representation
                video_output = output_dir / f"{repr_id}.mp4"
                
                (
                    ffmpeg
                    .input(input_path)
                    .output(
                        str(video_output),
                        vcodec='libx264',
                        acodec='aac',
                        s=preset['resolution'],
                        b=preset['bitrate'],
                        ab=preset['audio_bitrate'],
                        r=preset['framerate'],
                        movflags='frag_keyframe+empty_moov',
                        f='mp4'
                    )
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
                
                representations.append({
                    'id': repr_id,
                    'quality': quality,
                    'resolution': preset['resolution'],
                    'bandwidth': self._calculate_bandwidth(preset['bitrate'], preset['audio_bitrate']),
                    'file': f"{repr_id}.mp4"
                })
            
            # Generate DASH MPD manifest using mp4box or similar
            mpd_path = output_dir / "manifest.mpd"
            
            # Create basic MPD manifest
            mpd_content = self._create_dash_manifest(representations, output_name)
            with open(mpd_path, 'w') as f:
                f.write(mpd_content)
            
            return {
                'stream_id': output_name,
                'format': 'dash',
                'manifest': f"/streams/{output_name}/manifest.mpd",
                'representations': representations,
                'total_representations': len(representations),
                'status': 'ready'
            }
            
        except ffmpeg.Error as e:
            logger.error(f"DASH creation failed: {e}")
            raise HTTPException(status_code=500, detail=f"DASH creation failed: {e}")
    
    def _calculate_bandwidth(self, video_bitrate: str, audio_bitrate: str) -> int:
        """Calculate total bandwidth for stream variant."""
        # Convert bitrate strings to numbers
        video_bps = int(video_bitrate.rstrip('k')) * 1000
        audio_bps = int(audio_bitrate.rstrip('k')) * 1000
        return video_bps + audio_bps
    
    def _create_master_playlist(self, variants: List[Dict]) -> str:
        """Create HLS master playlist content."""
        content = ["#EXTM3U", "#EXT-X-VERSION:3"]
        
        for variant in variants:
            content.append(
                f"#EXT-X-STREAM-INF:BANDWIDTH={variant['bandwidth']},"
                f"RESOLUTION={variant['resolution']},CODECS=\"{variant['codecs']}\""
            )
            content.append(variant['playlist'])
        
        return '\n'.join(content) + '\n'
    
    def _create_dash_manifest(self, representations: List[Dict], stream_id: str) -> str:
        """Create basic DASH MPD manifest."""
        # This is a simplified MPD - in production, use proper DASH tools
        content = f'''<?xml version="1.0" encoding="utf-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" 
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="urn:mpeg:DASH:schema:MPD:2011 http://standards.iso.org/ittf/PubliclyAvailableStandards/MPEG-DASH_schema_files/DASH-MPD.xsd"
     type="static"
     mediaPresentationDuration="PT0H0M0S"
     profiles="urn:mpeg:dash:profile:isoff-live:2011">
  <Period>
    <AdaptationSet mimeType="video/mp4" codecs="avc1.42e00a">
'''
        
        for repr in representations:
            content += f'''      <Representation id="{repr['id']}" bandwidth="{repr['bandwidth']}" width="{repr['resolution'].split('x')[0]}" height="{repr['resolution'].split('x')[1]}">
        <BaseURL>{repr['file']}</BaseURL>
        <SegmentBase indexRange="1-1000"/>
      </Representation>
'''
        
        content += '''    </AdaptationSet>
  </Period>
</MPD>'''
        
        return content
    
    async def create_live_stream_endpoint(self, stream_key: str) -> Dict[str, Any]:
        """Set up live streaming endpoint for RTMP input."""
        try:
            # This would typically involve setting up RTMP server
            # For now, we'll create a placeholder for the live stream setup
            
            live_dir = self.output_dir / f"live_{stream_key}"
            live_dir.mkdir(parents=True, exist_ok=True)
            
            return {
                'stream_key': stream_key,
                'rtmp_url': f"rtmp://localhost:1935/live/{stream_key}",
                'hls_output': f"/streams/live_{stream_key}/playlist.m3u8",
                'status': 'ready',
                'message': 'Live stream endpoint created - start streaming to RTMP URL'
            }
            
        except Exception as e:
            logger.error(f"Live stream setup failed: {e}")
            raise HTTPException(status_code=500, detail=f"Live stream setup failed: {e}")

# Initialize media transcoder
transcoder = MediaTranscoder()

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup."""
    logger.info("Media Transcoder starting up...")
    
    # Verify FFmpeg installation and capabilities
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        logger.info("FFmpeg available")
        
        # Check for hardware acceleration
        result = subprocess.run(['ffmpeg', '-hwaccels'], capture_output=True, text=True)
        if 'vaapi' in result.stdout:
            logger.info("Hardware acceleration (VA-API) available")
        if 'nvenc' in result.stdout:
            logger.info("NVIDIA hardware acceleration available")
            
    except Exception as e:
        logger.warning(f"FFmpeg check failed: {e}")
    
    health_checker.mark_ready()
    logger.info("Media Transcoder ready to accept requests")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Media Transcoder shutting down...")
    file_manager.cleanup()

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return health_checker.get_health_status()

@app.get("/ready")
async def readiness_check():
    """Readiness probe endpoint."""
    return health_checker.get_readiness_status()

@app.post("/hls-transcode")
@require_auth(security_manager)
@limiter.limit("10/minute")
async def create_hls_stream_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    qualities: Optional[str] = Form('mobile,low,medium,high'),
    stream_name: Optional[str] = Form(None)
):
    """Create HLS adaptive bitrate stream from uploaded video."""
    
    # Validate file
    file_content = await file.read()
    is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Check if it's a supported video format
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in transcoder.supported_formats['input']:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported video format: {file_ext}"
        )
    
    # Generate stream ID and save file
    stream_id = stream_name or f"hls_{uuid.uuid4().hex[:8]}"
    input_path = await file_manager.save_uploaded_file(file_content, file.filename)
    
    # Parse quality settings
    quality_list = [q.strip() for q in qualities.split(',') if q.strip()]
    
    async def transcoding_task():
        """Background transcoding task."""
        try:
            # Analyze input media first
            analysis = await transcoder.analyze_media(input_path)
            
            # Create HLS stream
            result = await transcoder.create_hls_stream(input_path, stream_id, quality_list)
            
            # Add analysis info to result
            result['input_analysis'] = analysis
            result['processing_time'] = 'completed'
            
            return result
            
        except Exception as e:
            logger.error(f"HLS transcoding task failed: {e}")
            raise
    
    # Add to processing queue
    task_id = str(uuid.uuid4())
    await processing_queue.add_task(task_id, transcoding_task())
    
    return {
        'task_id': task_id,
        'stream_id': stream_id,
        'status': 'processing',
        'message': 'HLS transcoding started',
        'check_status_url': f'/status/{task_id}',
        'estimated_completion': 'varies by input size'
    }

@app.post("/dash")
@require_auth(security_manager)
@limiter.limit("10/minute")
async def create_dash_stream_endpoint(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    qualities: Optional[str] = Form('mobile,low,medium,high'),
    stream_name: Optional[str] = Form(None)
):
    """Create DASH adaptive bitrate stream from uploaded video."""
    
    # Validate file
    file_content = await file.read()
    is_valid, error_msg = resource_limiter.validate_file(file.filename, len(file_content))
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Generate stream ID and save file
    stream_id = stream_name or f"dash_{uuid.uuid4().hex[:8]}"
    input_path = await file_manager.save_uploaded_file(file_content, file.filename)
    
    # Parse quality settings
    quality_list = [q.strip() for q in qualities.split(',') if q.strip()]
    
    async def transcoding_task():
        """Background transcoding task."""
        try:
            # Analyze input media first
            analysis = await transcoder.analyze_media(input_path)
            
            # Create DASH stream
            result = await transcoder.create_dash_stream(input_path, stream_id, quality_list)
            
            # Add analysis info to result
            result['input_analysis'] = analysis
            
            return result
            
        except Exception as e:
            logger.error(f"DASH transcoding task failed: {e}")
            raise
    
    # Add to processing queue
    task_id = str(uuid.uuid4())
    await processing_queue.add_task(task_id, transcoding_task())
    
    return {
        'task_id': task_id,
        'stream_id': stream_id,
        'status': 'processing',
        'message': 'DASH transcoding started',
        'check_status_url': f'/status/{task_id}'
    }

@app.post("/live-stream")
@require_auth(security_manager)
async def setup_live_stream(
    stream_key: str = Form(...),
    qualities: Optional[str] = Form('mobile,low,medium')
):
    """Set up live streaming endpoint."""
    
    try:
        result = await transcoder.create_live_stream_endpoint(stream_key)
        return result
        
    except Exception as e:
        logger.error(f"Live stream setup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analyze/{stream_id}")
@require_auth(security_manager)
async def analyze_stream(stream_id: str):
    """Analyze existing stream for metrics and quality."""
    
    stream_dir = transcoder.output_dir / stream_id
    if not stream_dir.exists():
        raise HTTPException(status_code=404, detail="Stream not found")
    
    try:
        # Gather stream information
        variants = []
        master_playlist = stream_dir / "master.m3u8"
        
        if master_playlist.exists():
            # Parse HLS master playlist
            playlist = m3u8.load(str(master_playlist))
            for stream in playlist.playlists:
                variants.append({
                    'uri': stream.uri,
                    'bandwidth': stream.stream_info.bandwidth,
                    'resolution': stream.stream_info.resolution,
                    'codecs': stream.stream_info.codecs
                })
        
        return {
            'stream_id': stream_id,
            'type': 'hls' if master_playlist.exists() else 'dash',
            'variants': variants,
            'total_size': sum(f.stat().st_size for f in stream_dir.rglob('*') if f.is_file()),
            'created': datetime.fromtimestamp(stream_dir.stat().st_ctime).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Stream analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{task_id}")
@require_auth(security_manager)
async def get_task_status(task_id: str):
    """Get transcoding task status."""
    status = processing_queue.get_task_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found")
    return status

@app.delete("/stream/{stream_id}")
@require_auth(security_manager)
async def delete_stream(stream_id: str):
    """Delete streaming content and free up space."""
    
    stream_dir = transcoder.output_dir / stream_id
    if not stream_dir.exists():
        raise HTTPException(status_code=404, detail="Stream not found")
    
    try:
        # Calculate size before deletion
        total_size = sum(f.stat().st_size for f in stream_dir.rglob('*') if f.is_file())
        
        # Remove stream directory
        shutil.rmtree(stream_dir)
        
        return {
            'stream_id': stream_id,
            'status': 'deleted',
            'freed_bytes': total_size,
            'message': f'Stream {stream_id} deleted successfully'
        }
        
    except Exception as e:
        logger.error(f"Stream deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/streams")
async def list_streams():
    """List available streams."""
    
    streams = []
    
    for stream_dir in transcoder.output_dir.iterdir():
        if stream_dir.is_dir():
            # Check for master playlist (HLS) or manifest (DASH)
            master_playlist = stream_dir / "master.m3u8"
            dash_manifest = stream_dir / "manifest.mpd"
            
            stream_type = None
            endpoint = None
            
            if master_playlist.exists():
                stream_type = 'hls'
                endpoint = f"/streams/{stream_dir.name}/master.m3u8"
            elif dash_manifest.exists():
                stream_type = 'dash'
                endpoint = f"/streams/{stream_dir.name}/manifest.mpd"
            
            if stream_type:
                streams.append({
                    'id': stream_dir.name,
                    'type': stream_type,
                    'endpoint': endpoint,
                    'created': datetime.fromtimestamp(stream_dir.stat().st_ctime).isoformat(),
                    'size': sum(f.stat().st_size for f in stream_dir.rglob('*') if f.is_file())
                })
    
    return {
        'streams': streams,
        'total_streams': len(streams),
        'formats_supported': transcoder.supported_formats['streaming']
    }

@app.get("/quality-presets")
async def get_quality_presets():
    """Get available quality presets for transcoding."""
    return {
        'presets': transcoder.quality_presets,
        'recommended_combinations': {
            'mobile_only': ['mobile'],
            'basic': ['mobile', 'low'],
            'standard': ['mobile', 'low', 'medium'],
            'premium': ['mobile', 'low', 'medium', 'high'],
            'ultra': ['mobile', 'low', 'medium', 'high', 'ultra']
        }
    }

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