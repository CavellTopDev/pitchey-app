"""Shared utility functions for all containers."""
import os
import tempfile
import shutil
import logging
import asyncio
from typing import Optional, Dict, Any, Union
from pathlib import Path
import aiofiles
import aiohttp

logger = logging.getLogger(__name__)

class FileManager:
    """Manages file operations with cleanup and security."""
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp(prefix='pitchey_')
        self.cleanup_on_exit = True
        
    async def save_uploaded_file(self, file_content: bytes, filename: str) -> str:
        """Save uploaded file to temporary location."""
        safe_filename = self._sanitize_filename(filename)
        file_path = os.path.join(self.temp_dir, safe_filename)
        
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(file_content)
            
        logger.info(f"Saved file: {file_path}")
        return file_path
        
    def _sanitize_filename(self, filename: str) -> str:
        """Remove dangerous characters from filename."""
        # Keep only alphanumeric, dots, hyphens, underscores
        import re
        safe_name = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)
        return safe_name[:100]  # Limit length
        
    async def download_file(self, url: str, filename: str) -> str:
        """Download file from URL to temporary location."""
        safe_filename = self._sanitize_filename(filename)
        file_path = os.path.join(self.temp_dir, safe_filename)
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    async with aiofiles.open(file_path, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            await f.write(chunk)
                    
                    logger.info(f"Downloaded file: {file_path}")
                    return file_path
                else:
                    raise Exception(f"Failed to download file: {response.status}")
                    
    def cleanup(self):
        """Remove temporary files."""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            logger.info(f"Cleaned up temp directory: {self.temp_dir}")
            
    def __del__(self):
        """Cleanup on object destruction."""
        if self.cleanup_on_exit:
            self.cleanup()

class ProcessingQueue:
    """Simple async queue for processing tasks."""
    
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.active_tasks = {}
        
    async def add_task(self, task_id: str, coro):
        """Add task to processing queue."""
        async with self.semaphore:
            self.active_tasks[task_id] = {
                'status': 'processing',
                'started_at': asyncio.get_event_loop().time()
            }
            
            try:
                result = await coro
                self.active_tasks[task_id]['status'] = 'completed'
                self.active_tasks[task_id]['result'] = result
                return result
            except Exception as e:
                self.active_tasks[task_id]['status'] = 'failed'
                self.active_tasks[task_id]['error'] = str(e)
                raise
                
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get status of specific task."""
        return self.active_tasks.get(task_id)
        
    def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics."""
        total_tasks = len(self.active_tasks)
        processing = sum(1 for task in self.active_tasks.values() 
                        if task['status'] == 'processing')
        
        return {
            'total_tasks': total_tasks,
            'processing': processing,
            'completed': sum(1 for task in self.active_tasks.values() 
                           if task['status'] == 'completed'),
            'failed': sum(1 for task in self.active_tasks.values() 
                         if task['status'] == 'failed'),
            'available_slots': self.max_concurrent - processing
        }

def setup_logging(service_name: str, level: str = 'INFO'):
    """Setup logging configuration for container service."""
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format=f'%(asctime)s - {service_name} - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f'/tmp/{service_name}.log')
        ]
    )
    
    # Suppress some noisy loggers
    logging.getLogger('aiohttp').setLevel(logging.WARNING)
    logging.getLogger('asyncio').setLevel(logging.WARNING)

class ConfigManager:
    """Manages configuration from environment variables."""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.config = self._load_config()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from environment."""
        config = {
            # Common settings
            'port': int(os.getenv('PORT', 8080)),
            'debug': os.getenv('DEBUG', 'false').lower() == 'true',
            'max_workers': int(os.getenv('MAX_WORKERS', 4)),
            'timeout': int(os.getenv('TIMEOUT', 300)),
            
            # Storage settings
            'temp_dir': os.getenv('TEMP_DIR', '/tmp'),
            'max_file_size': int(os.getenv('MAX_FILE_SIZE', 100 * 1024 * 1024)),
            
            # Redis cache (optional)
            'redis_url': os.getenv('REDIS_URL'),
            'cache_ttl': int(os.getenv('CACHE_TTL', 3600)),
            
            # External services
            'api_base_url': os.getenv('API_BASE_URL', 'http://localhost:8001'),
        }
        
        # Service-specific configuration
        service_prefix = f'{self.service_name.upper().replace("-", "_")}_'
        for key, value in os.environ.items():
            if key.startswith(service_prefix):
                config_key = key[len(service_prefix):].lower()
                config[config_key] = value
                
        return config
        
    def get(self, key: str, default=None):
        """Get configuration value."""
        return self.config.get(key, default)