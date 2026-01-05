#!/usr/bin/env python3
"""Enhanced health check system for Pitchey Container Services.

This module provides comprehensive health monitoring including:
- Deep health checks for all services
- Dependency validation
- Performance metrics collection
- Alert trigger conditions
- Recovery recommendations
"""

import asyncio
import json
import logging
import psutil
import redis
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import aiohttp
import subprocess
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class HealthStatus(Enum):
    """Health status levels."""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"

@dataclass
class HealthMetric:
    """Health metric data structure."""
    name: str
    value: float
    unit: str
    status: HealthStatus
    threshold_warning: float
    threshold_critical: float
    description: str
    timestamp: datetime

@dataclass
class DependencyCheck:
    """Dependency check result."""
    name: str
    status: HealthStatus
    response_time_ms: float
    error_message: Optional[str]
    last_success: Optional[datetime]

class ContainerHealthMonitor:
    """Enhanced health monitoring for container services."""
    
    def __init__(self, service_name: str, redis_url: str = "redis://localhost:6379"):
        self.service_name = service_name
        self.redis_url = redis_url
        self.start_time = time.time()
        self.redis_client = None
        self.last_health_report = None
        
        # Health thresholds
        self.thresholds = {
            'cpu_percent': {'warning': 70.0, 'critical': 90.0},
            'memory_percent': {'warning': 80.0, 'critical': 95.0},
            'disk_percent': {'warning': 80.0, 'critical': 95.0},
            'response_time_ms': {'warning': 1000.0, 'critical': 5000.0},
            'error_rate_percent': {'warning': 5.0, 'critical': 15.0}
        }
        
    async def initialize(self):
        """Initialize monitoring connections."""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await asyncio.to_thread(self.redis_client.ping)
            logger.info(f"Health monitor initialized for {self.service_name}")
        except Exception as e:
            logger.error(f"Failed to initialize health monitor: {e}")
            
    async def get_system_metrics(self) -> List[HealthMetric]:
        """Collect system-level health metrics."""
        metrics = []
        
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_status = self._get_status(cpu_percent, 'cpu_percent')
            metrics.append(HealthMetric(
                name="cpu_usage",
                value=cpu_percent,
                unit="percent",
                status=cpu_status,
                threshold_warning=self.thresholds['cpu_percent']['warning'],
                threshold_critical=self.thresholds['cpu_percent']['critical'],
                description="Current CPU utilization",
                timestamp=datetime.utcnow()
            ))
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_status = self._get_status(memory.percent, 'memory_percent')
            metrics.append(HealthMetric(
                name="memory_usage",
                value=memory.percent,
                unit="percent",
                status=memory_status,
                threshold_warning=self.thresholds['memory_percent']['warning'],
                threshold_critical=self.thresholds['memory_percent']['critical'],
                description="Current memory utilization",
                timestamp=datetime.utcnow()
            ))
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            disk_status = self._get_status(disk_percent, 'disk_percent')
            metrics.append(HealthMetric(
                name="disk_usage",
                value=disk_percent,
                unit="percent",
                status=disk_status,
                threshold_warning=self.thresholds['disk_percent']['warning'],
                threshold_critical=self.thresholds['disk_percent']['critical'],
                description="Current disk utilization",
                timestamp=datetime.utcnow()
            ))
            
            # Process count
            process_count = len(psutil.pids())
            metrics.append(HealthMetric(
                name="process_count",
                value=process_count,
                unit="count",
                status=HealthStatus.HEALTHY,
                threshold_warning=1000,
                threshold_critical=2000,
                description="Number of running processes",
                timestamp=datetime.utcnow()
            ))
            
            # Load average (Unix only)
            if hasattr(os, 'getloadavg'):
                load_avg = os.getloadavg()[0]  # 1-minute load average
                load_status = HealthStatus.HEALTHY
                if load_avg > psutil.cpu_count() * 2:
                    load_status = HealthStatus.CRITICAL
                elif load_avg > psutil.cpu_count():
                    load_status = HealthStatus.WARNING
                    
                metrics.append(HealthMetric(
                    name="load_average_1m",
                    value=load_avg,
                    unit="ratio",
                    status=load_status,
                    threshold_warning=psutil.cpu_count(),
                    threshold_critical=psutil.cpu_count() * 2,
                    description="1-minute load average",
                    timestamp=datetime.utcnow()
                ))
                
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
            
        return metrics
        
    async def check_service_dependencies(self) -> List[DependencyCheck]:
        """Check health of service dependencies."""
        dependencies = []
        
        # Check Redis connection
        redis_check = await self._check_redis()
        dependencies.append(redis_check)
        
        # Check other container services
        service_endpoints = {
            'nginx-gateway': 'http://nginx:80/health',
            'video-processor': 'http://video-processor:8080/health',
            'document-processor': 'http://document-processor:8080/health',
            'ai-inference': 'http://ai-inference:8080/health',
            'media-transcoder': 'http://media-transcoder:8080/health',
            'code-executor': 'http://code-executor:8080/health'
        }
        
        for service_name, endpoint in service_endpoints.items():
            if service_name != self.service_name:  # Don't check self
                check = await self._check_http_endpoint(service_name, endpoint)
                dependencies.append(check)
                
        return dependencies
        
    async def _check_redis(self) -> DependencyCheck:
        """Check Redis connection health."""
        start_time = time.time()
        
        try:
            if not self.redis_client:
                await self.initialize()
                
            # Test basic operations
            test_key = f"health_check:{self.service_name}:{int(time.time())}"
            await asyncio.to_thread(self.redis_client.set, test_key, "test", ex=60)
            await asyncio.to_thread(self.redis_client.get, test_key)
            await asyncio.to_thread(self.redis_client.delete, test_key)
            
            response_time = (time.time() - start_time) * 1000
            
            return DependencyCheck(
                name="redis",
                status=HealthStatus.HEALTHY,
                response_time_ms=response_time,
                error_message=None,
                last_success=datetime.utcnow()
            )
            
        except Exception as e:
            return DependencyCheck(
                name="redis",
                status=HealthStatus.CRITICAL,
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=str(e),
                last_success=None
            )
            
    async def _check_http_endpoint(self, service_name: str, url: str) -> DependencyCheck:
        """Check HTTP endpoint health."""
        start_time = time.time()
        
        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        return DependencyCheck(
                            name=service_name,
                            status=HealthStatus.HEALTHY,
                            response_time_ms=response_time,
                            error_message=None,
                            last_success=datetime.utcnow()
                        )
                    else:
                        return DependencyCheck(
                            name=service_name,
                            status=HealthStatus.WARNING,
                            response_time_ms=response_time,
                            error_message=f"HTTP {response.status}",
                            last_success=None
                        )
                        
        except Exception as e:
            return DependencyCheck(
                name=service_name,
                status=HealthStatus.CRITICAL,
                response_time_ms=(time.time() - start_time) * 1000,
                error_message=str(e),
                last_success=None
            )
            
    def _get_status(self, value: float, metric_type: str) -> HealthStatus:
        """Determine health status based on thresholds."""
        if metric_type not in self.thresholds:
            return HealthStatus.UNKNOWN
            
        thresholds = self.thresholds[metric_type]
        
        if value >= thresholds['critical']:
            return HealthStatus.CRITICAL
        elif value >= thresholds['warning']:
            return HealthStatus.WARNING
        else:
            return HealthStatus.HEALTHY
            
    async def get_comprehensive_health_report(self) -> Dict[str, Any]:
        """Generate comprehensive health report."""
        report_start = time.time()
        
        # Collect all metrics
        system_metrics = await self.get_system_metrics()
        dependency_checks = await self.check_service_dependencies()
        
        # Calculate overall status
        overall_status = HealthStatus.HEALTHY
        critical_issues = []
        warning_issues = []
        
        # Check system metrics
        for metric in system_metrics:
            if metric.status == HealthStatus.CRITICAL:
                overall_status = HealthStatus.CRITICAL
                critical_issues.append(f"{metric.name}: {metric.value}{metric.unit}")
            elif metric.status == HealthStatus.WARNING and overall_status != HealthStatus.CRITICAL:
                overall_status = HealthStatus.WARNING
                warning_issues.append(f"{metric.name}: {metric.value}{metric.unit}")
                
        # Check dependencies
        for dep in dependency_checks:
            if dep.status == HealthStatus.CRITICAL:
                overall_status = HealthStatus.CRITICAL
                critical_issues.append(f"{dep.name}: {dep.error_message}")
            elif dep.status == HealthStatus.WARNING and overall_status != HealthStatus.CRITICAL:
                overall_status = HealthStatus.WARNING
                warning_issues.append(f"{dep.name}: slow response ({dep.response_time_ms}ms)")
                
        # Build comprehensive report
        report = {
            "service": self.service_name,
            "overall_status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": round(time.time() - self.start_time, 2),
            "report_generation_time_ms": round((time.time() - report_start) * 1000, 2),
            "system_metrics": [
                {
                    "name": m.name,
                    "value": m.value,
                    "unit": m.unit,
                    "status": m.status.value,
                    "threshold_warning": m.threshold_warning,
                    "threshold_critical": m.threshold_critical,
                    "description": m.description
                } for m in system_metrics
            ],
            "dependencies": [
                {
                    "name": d.name,
                    "status": d.status.value,
                    "response_time_ms": d.response_time_ms,
                    "error_message": d.error_message,
                    "last_success": d.last_success.isoformat() if d.last_success else None
                } for d in dependency_checks
            ],
            "issues": {
                "critical": critical_issues,
                "warning": warning_issues
            },
            "recommendations": self._generate_recommendations(system_metrics, dependency_checks)
        }
        
        # Cache report in Redis
        if self.redis_client:
            try:
                cache_key = f"health_report:{self.service_name}"
                await asyncio.to_thread(
                    self.redis_client.setex,
                    cache_key,
                    300,  # 5 minute TTL
                    json.dumps(report)
                )
            except Exception as e:
                logger.warning(f"Failed to cache health report: {e}")
                
        self.last_health_report = report
        return report
        
    def _generate_recommendations(self, metrics: List[HealthMetric], dependencies: List[DependencyCheck]) -> List[str]:
        """Generate actionable recommendations based on health data."""
        recommendations = []
        
        for metric in metrics:
            if metric.status == HealthStatus.CRITICAL:
                if metric.name == "cpu_usage":
                    recommendations.append("CRITICAL: High CPU usage detected. Consider scaling horizontally or optimizing workload.")
                elif metric.name == "memory_usage":
                    recommendations.append("CRITICAL: High memory usage detected. Check for memory leaks or increase container memory limits.")
                elif metric.name == "disk_usage":
                    recommendations.append("CRITICAL: High disk usage detected. Clean up temporary files or increase storage capacity.")
                    
            elif metric.status == HealthStatus.WARNING:
                if metric.name == "cpu_usage":
                    recommendations.append("WARNING: Elevated CPU usage. Monitor workload and consider optimization.")
                elif metric.name == "memory_usage":
                    recommendations.append("WARNING: Elevated memory usage. Monitor for potential memory leaks.")
                    
        for dep in dependencies:
            if dep.status == HealthStatus.CRITICAL:
                recommendations.append(f"CRITICAL: Dependency '{dep.name}' is unavailable. Check service health and network connectivity.")
            elif dep.status == HealthStatus.WARNING:
                recommendations.append(f"WARNING: Dependency '{dep.name}' is responding slowly ({dep.response_time_ms}ms). Check service performance.")
                
        if not recommendations:
            recommendations.append("All systems operating within normal parameters.")
            
        return recommendations

# FastAPI endpoints for health checks
async def create_health_endpoints(app, monitor: ContainerHealthMonitor):
    """Add health check endpoints to FastAPI app."""
    
    @app.get("/health")
    async def health_check():
        """Basic health check endpoint."""
        return {"status": "healthy", "service": monitor.service_name}
        
    @app.get("/health/live")
    async def liveness_probe():
        """Kubernetes liveness probe endpoint."""
        uptime = time.time() - monitor.start_time
        return {
            "status": "alive",
            "uptime_seconds": round(uptime, 2),
            "service": monitor.service_name
        }
        
    @app.get("/health/ready")
    async def readiness_probe():
        """Kubernetes readiness probe endpoint."""
        try:
            # Quick dependency checks for readiness
            if monitor.redis_client:
                await asyncio.to_thread(monitor.redis_client.ping)
                
            return {
                "status": "ready",
                "service": monitor.service_name,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            return {
                "status": "not_ready",
                "error": str(e),
                "service": monitor.service_name
            }
            
    @app.get("/health/detailed")
    async def detailed_health_check():
        """Comprehensive health check with full metrics."""
        report = await monitor.get_comprehensive_health_report()
        return report
        
    @app.get("/metrics")
    async def prometheus_metrics():
        """Prometheus metrics endpoint."""
        if not monitor.last_health_report:
            await monitor.get_comprehensive_health_report()
            
        metrics_output = []
        
        # Add system metrics
        for metric in monitor.last_health_report.get('system_metrics', []):
            metric_name = f"pitchey_{monitor.service_name}_{metric['name']}"
            metrics_output.append(f'{metric_name} {metric["value"]}')
            
        # Add dependency metrics
        for dep in monitor.last_health_report.get('dependencies', []):
            dep_name = f"pitchey_{monitor.service_name}_dependency_response_time"
            labels = f'{{dependency="{dep["name"]}"}}' 
            metrics_output.append(f'{dep_name}{labels} {dep["response_time_ms"]}')
            
            status_name = f"pitchey_{monitor.service_name}_dependency_status"
            status_value = 1 if dep["status"] == "healthy" else 0
            metrics_output.append(f'{status_name}{labels} {status_value}')
            
        return "\n".join(metrics_output)

if __name__ == "__main__":
    # Example usage for testing
    async def test_monitor():
        monitor = ContainerHealthMonitor("test-service")
        await monitor.initialize()
        
        report = await monitor.get_comprehensive_health_report()
        print(json.dumps(report, indent=2))
        
    asyncio.run(test_monitor())