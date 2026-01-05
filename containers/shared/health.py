"""Shared health check utilities for all containers."""
import asyncio
import time
from typing import Dict, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class HealthChecker:
    """Common health check functionality for all containers."""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.start_time = time.time()
        self.ready = False
        self.last_check = None
        
    def mark_ready(self):
        """Mark service as ready to accept requests."""
        self.ready = True
        self.last_check = datetime.utcnow()
        logger.info(f"{self.service_name} marked as ready")
        
    def get_health_status(self) -> Dict[str, Any]:
        """Get comprehensive health status."""
        uptime = time.time() - self.start_time
        
        return {
            "status": "healthy" if self.ready else "starting",
            "service": self.service_name,
            "uptime_seconds": round(uptime, 2),
            "ready": self.ready,
            "timestamp": datetime.utcnow().isoformat(),
            "last_check": self.last_check.isoformat() if self.last_check else None
        }
        
    def get_readiness_status(self) -> Dict[str, Any]:
        """Get readiness probe status."""
        return {
            "ready": self.ready,
            "service": self.service_name,
            "timestamp": datetime.utcnow().isoformat()
        }

async def check_dependencies(dependencies: Dict[str, callable]) -> Dict[str, bool]:
    """Check if external dependencies are available."""
    results = {}
    
    for name, check_func in dependencies.items():
        try:
            if asyncio.iscoroutinefunction(check_func):
                result = await check_func()
            else:
                result = check_func()
            results[name] = bool(result)
        except Exception as e:
            logger.warning(f"Dependency check failed for {name}: {e}")
            results[name] = False
            
    return results