#!/usr/bin/env python3
"""Comprehensive deployment automation system for Pitchey Container Services.

This module provides automated deployment capabilities including:
- GitOps workflow integration with ArgoCD
- Progressive deployment strategies (canary, blue-green, rolling)
- Automated rollback triggers based on metrics
- Feature flag management
- Environment promotion pipeline
"""

import asyncio
import json
import logging
import os
import subprocess
import time
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import aiohttp
import kubernetes
import git

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DeploymentStrategy(Enum):
    """Deployment strategy types."""
    ROLLING_UPDATE = "rolling_update"
    BLUE_GREEN = "blue_green"
    CANARY = "canary"
    IMMEDIATE = "immediate"

class DeploymentStatus(Enum):
    """Deployment status types."""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    VALIDATING = "VALIDATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"

class EnvironmentType(Enum):
    """Environment types."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"

@dataclass
class DeploymentPlan:
    """Deployment plan definition."""
    plan_id: str
    name: str
    strategy: DeploymentStrategy
    source_image: str
    target_environment: EnvironmentType
    services: List[str]
    rollback_on_failure: bool
    validation_checks: List[str]
    timeout_seconds: int
    created_by: str
    created_at: datetime
    status: DeploymentStatus
    progress_percentage: int = 0
    error_message: Optional[str] = None

@dataclass
class FeatureFlag:
    """Feature flag configuration."""
    name: str
    enabled: bool
    rollout_percentage: int
    target_segments: List[str]
    environments: List[str]
    conditions: Dict[str, Any]

class DeploymentAutomation:
    """Comprehensive deployment automation system."""
    
    def __init__(self, config_path: str = "/etc/deployment/automation-config.yml"):
        self.config_path = config_path
        self.config = self._load_config()
        
        # Initialize clients
        self.k8s_client = self._init_kubernetes_client()
        self.argocd_client = self._init_argocd_client()
        
        # Deployment state
        self.active_deployments = {}
        self.deployment_history = []
        self.feature_flags = {}
        
        # Directories
        self.workspace_dir = Path(self.config["workspace"]["directory"])
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        
        self.gitops_repo_dir = self.workspace_dir / "gitops"
        
        # Load feature flags
        self._load_feature_flags()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load deployment automation configuration."""
        default_config = {
            "workspace": {
                "directory": "/tmp/deployment-workspace"
            },
            "gitops": {
                "repository": "https://github.com/pitchey/pitchey-gitops.git",
                "branch": "main",
                "applications_path": "applications",
                "ssh_key_path": "/etc/deployment/ssh-key"
            },
            "argocd": {
                "server": "argocd-server:80",
                "token": "${ARGOCD_TOKEN}",
                "application_prefix": "pitchey"
            },
            "kubernetes": {
                "namespace": "pitchey-production",
                "kubeconfig_path": "/etc/deployment/kubeconfig"
            },
            "monitoring": {
                "prometheus_url": "http://prometheus:9090",
                "grafana_url": "http://grafana:3000"
            },
            "notifications": {
                "slack_webhook": "${SLACK_WEBHOOK_URL}",
                "email_recipients": ["devops@pitchey.com"]
            },
            "rollback": {
                "auto_rollback_enabled": True,
                "rollback_triggers": {
                    "error_rate_threshold": 5.0,
                    "response_time_threshold": 3.0,
                    "availability_threshold": 99.0
                },
                "monitoring_duration": 300  # 5 minutes
            },
            "deployment_strategies": {
                "canary": {
                    "initial_traffic_percentage": 10,
                    "traffic_increment": 20,
                    "wait_time_between_steps": 300,
                    "analysis_duration": 300
                },
                "blue_green": {
                    "validation_duration": 600,
                    "auto_promotion": False
                },
                "rolling_update": {
                    "max_unavailable": 1,
                    "max_surge": 1
                }
            }
        }
        
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                loaded_config = yaml.safe_load(f)
                if loaded_config:
                    self._deep_update(default_config, loaded_config)
                    
        return default_config
        
    def _deep_update(self, base_dict: Dict, update_dict: Dict):
        """Deep update dictionary."""
        for key, value in update_dict.items():
            if key in base_dict and isinstance(base_dict[key], dict) and isinstance(value, dict):
                self._deep_update(base_dict[key], value)
            else:
                base_dict[key] = value
                
    def _init_kubernetes_client(self):
        """Initialize Kubernetes client."""
        try:
            kubeconfig_path = self.config["kubernetes"]["kubeconfig_path"]
            if os.path.exists(kubeconfig_path):
                kubernetes.config.load_kube_config(config_file=kubeconfig_path)
            else:
                kubernetes.config.load_incluster_config()
                
            return kubernetes.client.AppsV1Api()
        except Exception as e:
            logger.error(f"Failed to initialize Kubernetes client: {e}")
            return None
            
    def _init_argocd_client(self):
        """Initialize ArgoCD client."""
        # This would initialize ArgoCD API client
        # For now, we'll use kubectl/argocd CLI
        return None
        
    def _load_feature_flags(self):
        """Load feature flags from configuration."""
        flags = {
            "enhanced_video_processing": FeatureFlag(
                name="enhanced_video_processing",
                enabled=False,
                rollout_percentage=0,
                target_segments=["beta_users"],
                environments=["staging"],
                conditions={}
            ),
            "ai_inference_v2": FeatureFlag(
                name="ai_inference_v2",
                enabled=True,
                rollout_percentage=25,
                target_segments=["premium_users"],
                environments=["staging", "production"],
                conditions={"user_tier": "premium"}
            ),
            "real_time_collaboration": FeatureFlag(
                name="real_time_collaboration",
                enabled=True,
                rollout_percentage=100,
                target_segments=["all"],
                environments=["production"],
                conditions={}
            )
        }
        
        self.feature_flags = flags
        
    async def create_deployment_plan(self, **kwargs) -> str:
        """Create new deployment plan."""
        plan_id = f"deploy_{int(time.time())}_{kwargs.get('strategy', 'rolling')}"
        
        plan = DeploymentPlan(
            plan_id=plan_id,
            name=kwargs.get("name", f"Deployment {plan_id}"),
            strategy=DeploymentStrategy(kwargs.get("strategy", "rolling_update")),
            source_image=kwargs["source_image"],
            target_environment=EnvironmentType(kwargs["target_environment"]),
            services=kwargs.get("services", []),
            rollback_on_failure=kwargs.get("rollback_on_failure", True),
            validation_checks=kwargs.get("validation_checks", []),
            timeout_seconds=kwargs.get("timeout_seconds", 1800),
            created_by=kwargs.get("created_by", "system"),
            created_at=datetime.utcnow(),
            status=DeploymentStatus.PENDING
        )
        
        self.active_deployments[plan_id] = plan
        logger.info(f"Created deployment plan: {plan_id}")
        
        return plan_id
        
    async def execute_deployment(self, plan_id: str) -> bool:
        """Execute deployment plan."""
        plan = self.active_deployments.get(plan_id)
        if not plan:
            logger.error(f"Deployment plan not found: {plan_id}")
            return False
            
        logger.info(f"Starting deployment: {plan.name} ({plan.strategy.value})")
        plan.status = DeploymentStatus.IN_PROGRESS
        
        try:
            # Prepare GitOps repository
            await self._prepare_gitops_repo()
            
            # Execute deployment based on strategy
            success = False
            if plan.strategy == DeploymentStrategy.CANARY:
                success = await self._execute_canary_deployment(plan)
            elif plan.strategy == DeploymentStrategy.BLUE_GREEN:
                success = await self._execute_blue_green_deployment(plan)
            elif plan.strategy == DeploymentStrategy.ROLLING_UPDATE:
                success = await self._execute_rolling_deployment(plan)
            elif plan.strategy == DeploymentStrategy.IMMEDIATE:
                success = await self._execute_immediate_deployment(plan)
                
            if success:
                plan.status = DeploymentStatus.COMPLETED
                plan.progress_percentage = 100
                logger.info(f"Deployment completed successfully: {plan_id}")
            else:
                plan.status = DeploymentStatus.FAILED
                logger.error(f"Deployment failed: {plan_id}")
                
                if plan.rollback_on_failure:
                    await self._execute_rollback(plan)
                    
        except Exception as e:
            plan.status = DeploymentStatus.FAILED
            plan.error_message = str(e)
            logger.error(f"Deployment error: {plan_id} - {e}")
            
            if plan.rollback_on_failure:
                await self._execute_rollback(plan)
                
        finally:
            # Move to history
            self.deployment_history.append(plan)
            if plan_id in self.active_deployments:
                del self.active_deployments[plan_id]
                
        return plan.status == DeploymentStatus.COMPLETED
        
    async def _prepare_gitops_repo(self):
        """Prepare GitOps repository for deployment."""
        gitops_config = self.config["gitops"]
        
        try:
            if self.gitops_repo_dir.exists():
                # Pull latest changes
                repo = git.Repo(self.gitops_repo_dir)
                repo.remotes.origin.pull()
            else:
                # Clone repository
                git.Repo.clone_from(
                    gitops_config["repository"],
                    self.gitops_repo_dir,
                    branch=gitops_config["branch"]
                )
                
            logger.info("GitOps repository prepared")
            
        except Exception as e:
            logger.error(f"Failed to prepare GitOps repository: {e}")
            raise
            
    async def _execute_canary_deployment(self, plan: DeploymentPlan) -> bool:
        """Execute canary deployment strategy."""
        logger.info(f"Starting canary deployment for {plan.name}")
        
        canary_config = self.config["deployment_strategies"]["canary"]
        
        try:
            # Step 1: Deploy canary version
            plan.progress_percentage = 10
            await self._deploy_canary_version(plan)
            
            # Step 2: Route initial traffic to canary
            plan.progress_percentage = 20
            initial_traffic = canary_config["initial_traffic_percentage"]
            await self._route_traffic_to_canary(plan, initial_traffic)
            
            # Step 3: Monitor and gradually increase traffic
            traffic_percentage = initial_traffic
            increment = canary_config["traffic_increment"]
            wait_time = canary_config["wait_time_between_steps"]
            
            while traffic_percentage < 100:
                # Wait and monitor
                await asyncio.sleep(wait_time)
                
                # Validate metrics
                if not await self._validate_canary_metrics(plan):
                    logger.error("Canary metrics validation failed")
                    return False
                    
                # Increase traffic
                traffic_percentage = min(100, traffic_percentage + increment)
                await self._route_traffic_to_canary(plan, traffic_percentage)
                
                plan.progress_percentage = 20 + (traffic_percentage * 0.7)
                logger.info(f"Canary traffic increased to {traffic_percentage}%")
                
            # Step 4: Complete canary promotion
            plan.progress_percentage = 95
            await self._promote_canary_to_stable(plan)
            
            plan.progress_percentage = 100
            logger.info(f"Canary deployment completed: {plan.name}")
            return True
            
        except Exception as e:
            logger.error(f"Canary deployment failed: {e}")
            await self._rollback_canary_deployment(plan)
            return False
            
    async def _execute_blue_green_deployment(self, plan: DeploymentPlan) -> bool:
        """Execute blue-green deployment strategy."""
        logger.info(f"Starting blue-green deployment for {plan.name}")
        
        bg_config = self.config["deployment_strategies"]["blue_green"]
        
        try:
            # Step 1: Deploy to green environment
            plan.progress_percentage = 20
            await self._deploy_green_environment(plan)
            
            # Step 2: Validate green environment
            plan.progress_percentage = 50
            await asyncio.sleep(bg_config["validation_duration"])
            
            if not await self._validate_green_environment(plan):
                logger.error("Green environment validation failed")
                return False
                
            # Step 3: Switch traffic to green
            plan.progress_percentage = 80
            if bg_config["auto_promotion"]:
                await self._switch_traffic_to_green(plan)
            else:
                # Wait for manual promotion
                logger.info("Waiting for manual promotion approval")
                # In practice, this would wait for approval via API/webhook
                await asyncio.sleep(60)
                await self._switch_traffic_to_green(plan)
                
            # Step 4: Cleanup old blue environment
            plan.progress_percentage = 95
            await self._cleanup_blue_environment(plan)
            
            plan.progress_percentage = 100
            logger.info(f"Blue-green deployment completed: {plan.name}")
            return True
            
        except Exception as e:
            logger.error(f"Blue-green deployment failed: {e}")
            return False
            
    async def _execute_rolling_deployment(self, plan: DeploymentPlan) -> bool:
        """Execute rolling update deployment strategy."""
        logger.info(f"Starting rolling deployment for {plan.name}")
        
        rolling_config = self.config["deployment_strategies"]["rolling_update"]
        
        try:
            # Update deployment with rolling update strategy
            plan.progress_percentage = 20
            
            for service in plan.services:
                await self._update_service_rolling(plan, service, rolling_config)
                plan.progress_percentage += 60 / len(plan.services)
                
            # Validate deployment
            plan.progress_percentage = 90
            if not await self._validate_rolling_deployment(plan):
                logger.error("Rolling deployment validation failed")
                return False
                
            plan.progress_percentage = 100
            logger.info(f"Rolling deployment completed: {plan.name}")
            return True
            
        except Exception as e:
            logger.error(f"Rolling deployment failed: {e}")
            return False
            
    async def _execute_immediate_deployment(self, plan: DeploymentPlan) -> bool:
        """Execute immediate deployment strategy."""
        logger.info(f"Starting immediate deployment for {plan.name}")
        
        try:
            # Update all services immediately
            plan.progress_percentage = 20
            
            for service in plan.services:
                await self._update_service_immediate(plan, service)
                plan.progress_percentage += 60 / len(plan.services)
                
            # Validate deployment
            plan.progress_percentage = 90
            if not await self._validate_immediate_deployment(plan):
                logger.error("Immediate deployment validation failed")
                return False
                
            plan.progress_percentage = 100
            logger.info(f"Immediate deployment completed: {plan.name}")
            return True
            
        except Exception as e:
            logger.error(f"Immediate deployment failed: {e}")
            return False
            
    async def _deploy_canary_version(self, plan: DeploymentPlan):
        """Deploy canary version of services."""
        for service in plan.services:
            # Create canary deployment manifest
            canary_manifest = self._generate_canary_manifest(plan, service)
            
            # Apply canary deployment
            await self._apply_kubernetes_manifest(canary_manifest)
            
            logger.info(f"Canary deployed for service: {service}")
            
    async def _route_traffic_to_canary(self, plan: DeploymentPlan, percentage: int):
        """Route specified percentage of traffic to canary."""
        for service in plan.services:
            # Update Istio virtual service or ingress
            traffic_manifest = self._generate_traffic_routing_manifest(plan, service, percentage)
            await self._apply_kubernetes_manifest(traffic_manifest)
            
        logger.info(f"Traffic routed to canary: {percentage}%")
        
    async def _validate_canary_metrics(self, plan: DeploymentPlan) -> bool:
        """Validate canary deployment metrics."""
        prometheus_url = self.config["monitoring"]["prometheus_url"]
        
        try:
            async with aiohttp.ClientSession() as session:
                # Check error rate
                error_rate_query = f'rate(http_requests_total{{service=~".*-canary",status=~"5.."}}[5m]) / rate(http_requests_total{{service=~".*-canary"}}[5m]) * 100'
                
                async with session.get(f"{prometheus_url}/api/v1/query", params={"query": error_rate_query}) as response:
                    data = await response.json()
                    
                    if data["status"] == "success" and data["data"]["result"]:
                        error_rate = float(data["data"]["result"][0]["value"][1])
                        
                        threshold = self.config["rollback"]["rollback_triggers"]["error_rate_threshold"]
                        if error_rate > threshold:
                            logger.error(f"Canary error rate too high: {error_rate}%")
                            return False
                            
                # Check response time
                response_time_query = 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service=~".*-canary"}[5m]))'
                
                async with session.get(f"{prometheus_url}/api/v1/query", params={"query": response_time_query}) as response:
                    data = await response.json()
                    
                    if data["status"] == "success" and data["data"]["result"]:
                        response_time = float(data["data"]["result"][0]["value"][1])
                        
                        threshold = self.config["rollback"]["rollback_triggers"]["response_time_threshold"]
                        if response_time > threshold:
                            logger.error(f"Canary response time too high: {response_time}s")
                            return False
                            
            return True
            
        except Exception as e:
            logger.error(f"Metrics validation failed: {e}")
            return False
            
    async def _promote_canary_to_stable(self, plan: DeploymentPlan):
        """Promote canary version to stable."""
        for service in plan.services:
            # Update stable deployment with canary image
            stable_manifest = self._generate_stable_manifest(plan, service)
            await self._apply_kubernetes_manifest(stable_manifest)
            
            # Remove canary deployment
            await self._remove_canary_deployment(plan, service)
            
        logger.info("Canary promoted to stable")
        
    async def _execute_rollback(self, plan: DeploymentPlan):
        """Execute deployment rollback."""
        logger.info(f"Starting rollback for deployment: {plan.plan_id}")
        
        plan.status = DeploymentStatus.ROLLED_BACK
        
        try:
            if plan.strategy == DeploymentStrategy.CANARY:
                await self._rollback_canary_deployment(plan)
            elif plan.strategy == DeploymentStrategy.BLUE_GREEN:
                await self._rollback_blue_green_deployment(plan)
            else:
                await self._rollback_standard_deployment(plan)
                
            # Send notification
            await self._send_rollback_notification(plan)
            
            logger.info(f"Rollback completed for deployment: {plan.plan_id}")
            
        except Exception as e:
            logger.error(f"Rollback failed: {e}")
            
    async def _rollback_canary_deployment(self, plan: DeploymentPlan):
        """Rollback canary deployment."""
        # Route all traffic back to stable
        await self._route_traffic_to_canary(plan, 0)
        
        # Remove canary deployments
        for service in plan.services:
            await self._remove_canary_deployment(plan, service)
            
    async def _generate_canary_manifest(self, plan: DeploymentPlan, service: str) -> str:
        """Generate Kubernetes manifest for canary deployment."""
        manifest = f"""
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {service}-canary
  namespace: {self.config['kubernetes']['namespace']}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: {service}
      version: canary
  template:
    metadata:
      labels:
        app: {service}
        version: canary
    spec:
      containers:
      - name: {service}
        image: {plan.source_image}
        ports:
        - containerPort: 8080
        env:
        - name: VERSION
          value: canary
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
"""
        return manifest
        
    async def _apply_kubernetes_manifest(self, manifest: str):
        """Apply Kubernetes manifest."""
        # Write manifest to temp file
        manifest_file = self.workspace_dir / f"manifest_{int(time.time())}.yml"
        with open(manifest_file, 'w') as f:
            f.write(manifest)
            
        try:
            # Apply manifest using kubectl
            result = subprocess.run(
                ["kubectl", "apply", "-f", str(manifest_file)],
                capture_output=True,
                text=True,
                check=True
            )
            
            logger.debug(f"Manifest applied successfully: {result.stdout}")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to apply manifest: {e.stderr}")
            raise
        finally:
            # Clean up temp file
            manifest_file.unlink()
            
    def is_feature_enabled(self, feature_name: str, user_id: str = None,
                          user_segment: str = None, environment: str = None) -> bool:
        """Check if feature flag is enabled."""
        flag = self.feature_flags.get(feature_name)
        if not flag:
            return False
            
        # Check environment
        if environment and environment not in flag.environments:
            return False
            
        # Check user segment
        if user_segment and user_segment not in flag.target_segments and "all" not in flag.target_segments:
            return False
            
        # Check rollout percentage
        if flag.rollout_percentage < 100:
            if user_id:
                # Consistent hash-based rollout
                user_hash = hash(user_id) % 100
                return user_hash < flag.rollout_percentage
            else:
                # Random rollout for anonymous users
                import random
                return random.randint(0, 99) < flag.rollout_percentage
                
        return flag.enabled
        
    async def update_feature_flag(self, feature_name: str, **kwargs):
        """Update feature flag configuration."""
        if feature_name not in self.feature_flags:
            logger.error(f"Feature flag not found: {feature_name}")
            return
            
        flag = self.feature_flags[feature_name]
        
        if "enabled" in kwargs:
            flag.enabled = kwargs["enabled"]
        if "rollout_percentage" in kwargs:
            flag.rollout_percentage = kwargs["rollout_percentage"]
        if "target_segments" in kwargs:
            flag.target_segments = kwargs["target_segments"]
        if "environments" in kwargs:
            flag.environments = kwargs["environments"]
            
        logger.info(f"Feature flag updated: {feature_name}")
        
    async def get_deployment_status(self, plan_id: str) -> Optional[DeploymentPlan]:
        """Get deployment status."""
        plan = self.active_deployments.get(plan_id)
        if not plan:
            # Check history
            for historical_plan in self.deployment_history:
                if historical_plan.plan_id == plan_id:
                    return historical_plan
        return plan
        
    async def list_active_deployments(self) -> List[DeploymentPlan]:
        """List all active deployments."""
        return list(self.active_deployments.values())
        
    async def _send_rollback_notification(self, plan: DeploymentPlan):
        """Send rollback notification."""
        slack_webhook = self.config["notifications"]["slack_webhook"]
        
        if slack_webhook:
            message = {
                "text": f"🔄 Deployment Rollback Executed",
                "attachments": [
                    {
                        "color": "warning",
                        "fields": [
                            {"title": "Plan ID", "value": plan.plan_id, "short": True},
                            {"title": "Name", "value": plan.name, "short": True},
                            {"title": "Strategy", "value": plan.strategy.value, "short": True},
                            {"title": "Environment", "value": plan.target_environment.value, "short": True},
                            {"title": "Error", "value": plan.error_message or "Unknown", "short": False}
                        ]
                    }
                ]
            }
            
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(slack_webhook, json=message) as response:
                        if response.status == 200:
                            logger.info("Rollback notification sent")
                        else:
                            logger.error(f"Failed to send notification: {response.status}")
            except Exception as e:
                logger.error(f"Notification error: {e}")

async def main():
    """Main function for testing deployment automation."""
    automation = DeploymentAutomation()
    
    # Example: Create and execute a canary deployment
    plan_id = await automation.create_deployment_plan(
        name="Video Processor v2.1",
        strategy="canary",
        source_image="pitchey/video-processor:v2.1.0",
        target_environment="production",
        services=["video-processor"],
        rollback_on_failure=True
    )
    
    success = await automation.execute_deployment(plan_id)
    print(f"Deployment result: {success}")

if __name__ == "__main__":
    asyncio.run(main())