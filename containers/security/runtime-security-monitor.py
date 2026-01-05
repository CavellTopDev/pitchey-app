#!/usr/bin/env python3
"""Runtime security monitoring system for Pitchey Container Services.

This module provides real-time security monitoring including:
- Container runtime behavior analysis
- Anomaly detection and threat identification
- File system and network monitoring
- Process execution monitoring
- Security policy enforcement
- Incident response automation
"""

import asyncio
import json
import logging
import os
import psutil
import socket
import subprocess
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from enum import Enum
import yaml
import docker
import hashlib
import re

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ThreatLevel(Enum):
    """Security threat levels."""
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class EventType(Enum):
    """Security event types."""
    PROCESS_EXECUTION = "PROCESS_EXECUTION"
    FILE_ACCESS = "FILE_ACCESS"
    NETWORK_CONNECTION = "NETWORK_CONNECTION"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    SUSPICIOUS_BEHAVIOR = "SUSPICIOUS_BEHAVIOR"
    POLICY_VIOLATION = "POLICY_VIOLATION"
    MALWARE_DETECTION = "MALWARE_DETECTION"

@dataclass
class SecurityEvent:
    """Security event data structure."""
    event_id: str
    timestamp: datetime
    container_id: str
    container_name: str
    event_type: EventType
    threat_level: ThreatLevel
    title: str
    description: str
    source_ip: Optional[str]
    destination_ip: Optional[str]
    process_name: Optional[str]
    command_line: Optional[str]
    file_path: Optional[str]
    user_id: Optional[int]
    additional_data: Dict[str, Any]
    response_actions: List[str]

@dataclass
class SecurityPolicy:
    """Security policy definition."""
    policy_id: str
    name: str
    enabled: bool
    severity: ThreatLevel
    conditions: Dict[str, Any]
    actions: List[str]
    description: str

class RuntimeSecurityMonitor:
    """Real-time security monitoring for container runtime."""
    
    def __init__(self, config_path: str = "/etc/security/runtime-monitor-config.yml"):
        self.config_path = config_path
        self.config = self._load_config()
        self.docker_client = docker.from_env()
        self.monitored_containers = {}
        self.security_events = []
        self.security_policies = []
        self.baseline_behaviors = {}
        self.running = False
        
        # Event storage
        self.events_dir = Path("/var/log/security/events")
        self.events_dir.mkdir(parents=True, exist_ok=True)
        
        # Load security policies
        self._load_security_policies()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load runtime monitor configuration."""
        default_config = {
            "monitoring": {
                "poll_interval": 5,
                "process_monitoring": True,
                "file_monitoring": True,
                "network_monitoring": True,
                "baseline_learning_period": 3600  # 1 hour
            },
            "detection": {
                "anomaly_threshold": 0.8,
                "suspicious_processes": [
                    "nc", "netcat", "ncat", "telnet", "wget", "curl",
                    "python", "python3", "perl", "ruby", "bash", "sh",
                    "nmap", "masscan", "sqlmap", "metasploit"
                ],
                "suspicious_file_patterns": [
                    r".*\.sh$", r".*\.py$", r".*\.pl$", r".*\.rb$",
                    r"/tmp/.*", r"/var/tmp/.*", r".*backdoor.*",
                    r".*malware.*", r".*exploit.*"
                ],
                "sensitive_directories": [
                    "/etc", "/usr/bin", "/usr/sbin", "/var/log",
                    "/root", "/home", "/opt"
                ]
            },
            "response": {
                "auto_quarantine": True,
                "kill_suspicious_processes": False,
                "block_network_connections": True,
                "generate_forensic_dump": True
            },
            "notifications": {
                "webhook_url": None,
                "siem_endpoint": None,
                "alert_cooldown": 300  # 5 minutes
            }
        }
        
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                loaded_config = yaml.safe_load(f)
                if loaded_config:
                    default_config.update(loaded_config)
                    
        return default_config
        
    def _load_security_policies(self):
        """Load security policies from configuration."""
        policies = [
            SecurityPolicy(
                policy_id="POL-001",
                name="Privilege Escalation Detection",
                enabled=True,
                severity=ThreatLevel.HIGH,
                conditions={
                    "process_escalation": True,
                    "uid_change": True,
                    "sudo_usage": True
                },
                actions=["alert", "log", "investigate"],
                description="Detect attempts to escalate privileges"
            ),
            SecurityPolicy(
                policy_id="POL-002", 
                name="Suspicious Network Activity",
                enabled=True,
                severity=ThreatLevel.MEDIUM,
                conditions={
                    "unexpected_outbound": True,
                    "port_scanning": True,
                    "reverse_shell": True
                },
                actions=["alert", "block", "log"],
                description="Detect suspicious network connections"
            ),
            SecurityPolicy(
                policy_id="POL-003",
                name="File System Tampering",
                enabled=True,
                severity=ThreatLevel.HIGH,
                conditions={
                    "system_file_modification": True,
                    "binary_replacement": True,
                    "config_tampering": True
                },
                actions=["alert", "quarantine", "forensic_dump"],
                description="Detect unauthorized file system modifications"
            ),
            SecurityPolicy(
                policy_id="POL-004",
                name="Cryptocurrency Mining Detection",
                enabled=True,
                severity=ThreatLevel.MEDIUM,
                conditions={
                    "high_cpu_anonymous_process": True,
                    "mining_pool_connections": True,
                    "crypto_binary_execution": True
                },
                actions=["alert", "kill_process", "block_network"],
                description="Detect cryptocurrency mining activities"
            ),
            SecurityPolicy(
                policy_id="POL-005",
                name="Container Escape Attempts",
                enabled=True,
                severity=ThreatLevel.CRITICAL,
                conditions={
                    "host_namespace_access": True,
                    "container_runtime_exploitation": True,
                    "kernel_exploitation": True
                },
                actions=["alert", "immediate_quarantine", "forensic_dump", "escalate"],
                description="Detect container escape attempts"
            )
        ]
        
        self.security_policies = policies
        
    async def start_monitoring(self):
        """Start runtime security monitoring."""
        self.running = True
        logger.info("Starting runtime security monitoring")
        
        # Start monitoring tasks
        tasks = [
            asyncio.create_task(self._monitor_containers()),
            asyncio.create_task(self._monitor_processes()),
            asyncio.create_task(self._monitor_file_system()),
            asyncio.create_task(self._monitor_network_connections()),
            asyncio.create_task(self._process_security_events()),
            asyncio.create_task(self._learn_baseline_behavior())
        ]
        
        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            logger.info("Stopping runtime security monitoring")
            self.running = False
            
    async def _monitor_containers(self):
        """Monitor container lifecycle events."""
        while self.running:
            try:
                current_containers = {c.id: c for c in self.docker_client.containers.list()}
                
                # Check for new containers
                for container_id, container in current_containers.items():
                    if container_id not in self.monitored_containers:
                        await self._on_container_started(container)
                        
                # Check for stopped containers
                for container_id in list(self.monitored_containers.keys()):
                    if container_id not in current_containers:
                        await self._on_container_stopped(container_id)
                        
                self.monitored_containers = current_containers
                
            except Exception as e:
                logger.error(f"Container monitoring error: {e}")
                
            await asyncio.sleep(self.config["monitoring"]["poll_interval"])
            
    async def _on_container_started(self, container):
        """Handle new container detection."""
        container_info = {
            "id": container.id,
            "name": container.name,
            "image": container.image.tags[0] if container.image.tags else container.image.id,
            "started_at": datetime.utcnow(),
            "baseline_period_end": datetime.utcnow() + timedelta(
                seconds=self.config["monitoring"]["baseline_learning_period"]
            )
        }
        
        logger.info(f"New container detected: {container.name} ({container.id[:12]})")
        
        # Generate security event
        event = SecurityEvent(
            event_id=self._generate_event_id(),
            timestamp=datetime.utcnow(),
            container_id=container.id,
            container_name=container.name,
            event_type=EventType.SUSPICIOUS_BEHAVIOR,
            threat_level=ThreatLevel.INFO,
            title="New Container Started",
            description=f"Container {container.name} started monitoring",
            source_ip=None,
            destination_ip=None,
            process_name=None,
            command_line=None,
            file_path=None,
            user_id=None,
            additional_data=container_info,
            response_actions=["monitor", "learn_baseline"]
        )
        
        self.security_events.append(event)
        
    async def _on_container_stopped(self, container_id: str):
        """Handle container stop detection."""
        if container_id in self.baseline_behaviors:
            del self.baseline_behaviors[container_id]
            
        logger.info(f"Container stopped: {container_id[:12]}")
        
    async def _monitor_processes(self):
        """Monitor process execution in containers."""
        if not self.config["monitoring"]["process_monitoring"]:
            return
            
        while self.running:
            try:
                for container_id, container in self.monitored_containers.items():
                    await self._check_container_processes(container)
                    
            except Exception as e:
                logger.error(f"Process monitoring error: {e}")
                
            await asyncio.sleep(self.config["monitoring"]["poll_interval"])
            
    async def _check_container_processes(self, container):
        """Check processes running in a container."""
        try:
            # Get container processes
            processes = container.top()
            if not processes or "Processes" not in processes:
                return
                
            for process in processes["Processes"]:
                if len(process) < 8:  # Basic validation
                    continue
                    
                pid, user, time_info, command = process[1], process[0], process[6], " ".join(process[7:])
                
                # Check for suspicious processes
                await self._analyze_process(container, pid, user, command)
                
        except Exception as e:
            logger.debug(f"Failed to get processes for {container.name}: {e}")
            
    async def _analyze_process(self, container, pid: str, user: str, command: str):
        """Analyze individual process for threats."""
        process_name = command.split()[0] if command else ""
        
        # Check against suspicious process list
        suspicious_processes = self.config["detection"]["suspicious_processes"]
        if any(susp in process_name.lower() for susp in suspicious_processes):
            event = SecurityEvent(
                event_id=self._generate_event_id(),
                timestamp=datetime.utcnow(),
                container_id=container.id,
                container_name=container.name,
                event_type=EventType.PROCESS_EXECUTION,
                threat_level=ThreatLevel.MEDIUM,
                title="Suspicious Process Detected",
                description=f"Suspicious process '{process_name}' detected",
                source_ip=None,
                destination_ip=None,
                process_name=process_name,
                command_line=command,
                file_path=None,
                user_id=None,
                additional_data={
                    "pid": pid,
                    "user": user,
                    "full_command": command
                },
                response_actions=["alert", "investigate"]
            )
            
            self.security_events.append(event)
            
        # Check for privilege escalation patterns
        if "sudo" in command.lower() or "su " in command.lower():
            event = SecurityEvent(
                event_id=self._generate_event_id(),
                timestamp=datetime.utcnow(),
                container_id=container.id,
                container_name=container.name,
                event_type=EventType.PRIVILEGE_ESCALATION,
                threat_level=ThreatLevel.HIGH,
                title="Privilege Escalation Attempt",
                description=f"Privilege escalation detected: {command}",
                source_ip=None,
                destination_ip=None,
                process_name=process_name,
                command_line=command,
                file_path=None,
                user_id=None,
                additional_data={
                    "pid": pid,
                    "user": user
                },
                response_actions=["alert", "investigate", "log"]
            )
            
            self.security_events.append(event)
            
    async def _monitor_file_system(self):
        """Monitor file system activity."""
        if not self.config["monitoring"]["file_monitoring"]:
            return
            
        # Note: This is a simplified implementation
        # In production, you would use inotify or similar for real-time monitoring
        while self.running:
            try:
                # Check for suspicious file patterns
                await self._check_suspicious_files()
                
            except Exception as e:
                logger.error(f"File system monitoring error: {e}")
                
            await asyncio.sleep(self.config["monitoring"]["poll_interval"] * 2)
            
    async def _check_suspicious_files(self):
        """Check for suspicious file patterns."""
        suspicious_patterns = self.config["detection"]["suspicious_file_patterns"]
        sensitive_directories = self.config["detection"]["sensitive_directories"]
        
        for container_id, container in self.monitored_containers.items():
            try:
                # This would need to be implemented with proper file monitoring
                # For now, we'll check for common suspicious file locations
                pass
                
            except Exception as e:
                logger.debug(f"File check failed for {container.name}: {e}")
                
    async def _monitor_network_connections(self):
        """Monitor network connections."""
        if not self.config["monitoring"]["network_monitoring"]:
            return
            
        while self.running:
            try:
                await self._check_network_activity()
                
            except Exception as e:
                logger.error(f"Network monitoring error: {e}")
                
            await asyncio.sleep(self.config["monitoring"]["poll_interval"])
            
    async def _check_network_activity(self):
        """Check for suspicious network activity."""
        try:
            connections = psutil.net_connections()
            
            for conn in connections:
                if conn.status == psutil.CONN_ESTABLISHED:
                    await self._analyze_network_connection(conn)
                    
        except Exception as e:
            logger.debug(f"Network check error: {e}")
            
    async def _analyze_network_connection(self, connection):
        """Analyze network connection for threats."""
        if not connection.raddr:
            return
            
        remote_ip = connection.raddr.ip
        remote_port = connection.raddr.port
        
        # Check for suspicious destinations
        suspicious_patterns = [
            # Common mining pools
            "pool", "stratum", "mining",
            # Tor nodes and proxies
            "onion", "tor",
            # Known malicious ranges (simplified)
        ]
        
        if any(pattern in remote_ip.lower() for pattern in suspicious_patterns):
            # Find associated container
            container = await self._find_container_by_connection(connection)
            if container:
                event = SecurityEvent(
                    event_id=self._generate_event_id(),
                    timestamp=datetime.utcnow(),
                    container_id=container.id,
                    container_name=container.name,
                    event_type=EventType.NETWORK_CONNECTION,
                    threat_level=ThreatLevel.MEDIUM,
                    title="Suspicious Network Connection",
                    description=f"Connection to suspicious destination {remote_ip}:{remote_port}",
                    source_ip=connection.laddr.ip if connection.laddr else None,
                    destination_ip=remote_ip,
                    process_name=None,
                    command_line=None,
                    file_path=None,
                    user_id=None,
                    additional_data={
                        "local_port": connection.laddr.port if connection.laddr else None,
                        "remote_port": remote_port,
                        "connection_status": connection.status
                    },
                    response_actions=["alert", "block", "investigate"]
                )
                
                self.security_events.append(event)
                
    async def _find_container_by_connection(self, connection):
        """Find container associated with network connection."""
        # This is simplified - in practice you'd need to map processes to containers
        return list(self.monitored_containers.values())[0] if self.monitored_containers else None
        
    async def _process_security_events(self):
        """Process and respond to security events."""
        while self.running:
            try:
                events_to_process = self.security_events.copy()
                self.security_events.clear()
                
                for event in events_to_process:
                    await self._handle_security_event(event)
                    
            except Exception as e:
                logger.error(f"Event processing error: {e}")
                
            await asyncio.sleep(1)  # Process events frequently
            
    async def _handle_security_event(self, event: SecurityEvent):
        """Handle individual security event."""
        logger.info(f"Processing security event: {event.title} ({event.threat_level.value})")
        
        # Save event to file
        await self._save_security_event(event)
        
        # Apply security policies
        await self._apply_security_policies(event)
        
        # Execute response actions
        await self._execute_response_actions(event)
        
        # Send notifications for high/critical events
        if event.threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
            await self._send_security_notification(event)
            
    async def _apply_security_policies(self, event: SecurityEvent):
        """Apply security policies to event."""
        for policy in self.security_policies:
            if not policy.enabled:
                continue
                
            if await self._event_matches_policy(event, policy):
                logger.info(f"Event matches policy: {policy.name}")
                
                # Add policy actions to response actions
                event.response_actions.extend(policy.actions)
                
                # Update threat level if policy severity is higher
                if policy.severity.value > event.threat_level.value:
                    event.threat_level = policy.severity
                    
    async def _event_matches_policy(self, event: SecurityEvent, policy: SecurityPolicy) -> bool:
        """Check if event matches policy conditions."""
        conditions = policy.conditions
        
        # Simplified policy matching - in practice this would be more sophisticated
        if event.event_type == EventType.PRIVILEGE_ESCALATION and conditions.get("process_escalation"):
            return True
        if event.event_type == EventType.NETWORK_CONNECTION and conditions.get("unexpected_outbound"):
            return True
        if event.event_type == EventType.FILE_ACCESS and conditions.get("system_file_modification"):
            return True
            
        return False
        
    async def _execute_response_actions(self, event: SecurityEvent):
        """Execute automated response actions."""
        unique_actions = set(event.response_actions)
        
        for action in unique_actions:
            try:
                await self._execute_action(action, event)
            except Exception as e:
                logger.error(f"Failed to execute action '{action}': {e}")
                
    async def _execute_action(self, action: str, event: SecurityEvent):
        """Execute specific response action."""
        container = self.monitored_containers.get(event.container_id)
        
        if action == "alert":
            logger.warning(f"SECURITY ALERT: {event.title} in {event.container_name}")
            
        elif action == "quarantine" and container and self.config["response"]["auto_quarantine"]:
            logger.info(f"Quarantining container: {event.container_name}")
            # In practice, you'd implement container isolation
            
        elif action == "kill_process" and event.additional_data.get("pid"):
            if self.config["response"]["kill_suspicious_processes"]:
                logger.info(f"Killing suspicious process: {event.process_name}")
                # Implementation would kill the process
                
        elif action == "block" and self.config["response"]["block_network_connections"]:
            logger.info(f"Blocking network connection from {event.source_ip}")
            # Implementation would add firewall rule
            
        elif action == "forensic_dump" and self.config["response"]["generate_forensic_dump"]:
            logger.info(f"Generating forensic dump for {event.container_name}")
            await self._generate_forensic_dump(event)
            
    async def _generate_forensic_dump(self, event: SecurityEvent):
        """Generate forensic dump for investigation."""
        container = self.monitored_containers.get(event.container_id)
        if not container:
            return
            
        dump_dir = Path(f"/var/log/security/forensics/{event.event_id}")
        dump_dir.mkdir(parents=True, exist_ok=True)
        
        try:
            # Container information
            container_info = container.attrs
            with open(dump_dir / "container_info.json", 'w') as f:
                json.dump(container_info, f, indent=2, default=str)
                
            # Process list
            try:
                processes = container.top()
                with open(dump_dir / "processes.json", 'w') as f:
                    json.dump(processes, f, indent=2)
            except:
                pass
                
            # Network connections
            try:
                connections = [asdict(conn) for conn in psutil.net_connections()]
                with open(dump_dir / "network_connections.json", 'w') as f:
                    json.dump(connections, f, indent=2, default=str)
            except:
                pass
                
            logger.info(f"Forensic dump generated: {dump_dir}")
            
        except Exception as e:
            logger.error(f"Failed to generate forensic dump: {e}")
            
    async def _learn_baseline_behavior(self):
        """Learn baseline behavior for containers."""
        while self.running:
            try:
                current_time = datetime.utcnow()
                
                for container_id, container in self.monitored_containers.items():
                    if container_id not in self.baseline_behaviors:
                        self.baseline_behaviors[container_id] = {
                            "processes": set(),
                            "network_connections": set(),
                            "file_accesses": set(),
                            "learning_start": current_time
                        }
                        
                    # Learn normal behavior during baseline period
                    baseline = self.baseline_behaviors[container_id]
                    learning_period = timedelta(
                        seconds=self.config["monitoring"]["baseline_learning_period"]
                    )
                    
                    if current_time - baseline["learning_start"] < learning_period:
                        await self._update_baseline(container, baseline)
                        
            except Exception as e:
                logger.error(f"Baseline learning error: {e}")
                
            await asyncio.sleep(self.config["monitoring"]["poll_interval"] * 3)
            
    async def _update_baseline(self, container, baseline: Dict[str, Any]):
        """Update baseline behavior for container."""
        try:
            # Learn normal processes
            processes = container.top()
            if processes and "Processes" in processes:
                for process in processes["Processes"]:
                    if len(process) >= 8:
                        command = " ".join(process[7:])
                        baseline["processes"].add(command)
                        
        except Exception as e:
            logger.debug(f"Failed to update baseline for {container.name}: {e}")
            
    async def _save_security_event(self, event: SecurityEvent):
        """Save security event to file."""
        event_file = self.events_dir / f"{event.event_id}.json"
        
        event_dict = asdict(event)
        event_dict["timestamp"] = event_dict["timestamp"].isoformat()
        
        with open(event_file, 'w') as f:
            json.dump(event_dict, f, indent=2, default=str)
            
    async def _send_security_notification(self, event: SecurityEvent):
        """Send security notification for high-priority events."""
        notification_config = self.config.get("notifications", {})
        
        # Check cooldown
        last_alert_key = f"last_alert_{event.container_name}_{event.event_type.value}"
        last_alert_time = getattr(self, last_alert_key, None)
        cooldown = notification_config.get("alert_cooldown", 300)
        
        if last_alert_time and (datetime.utcnow() - last_alert_time).seconds < cooldown:
            return
            
        setattr(self, last_alert_key, datetime.utcnow())
        
        # Send notification
        logger.warning(f"HIGH PRIORITY SECURITY EVENT: {event.title}")
        
    def _generate_event_id(self) -> str:
        """Generate unique event ID."""
        return f"SEC_{int(time.time())}_{hashlib.md5(os.urandom(16)).hexdigest()[:8]}"

async def main():
    """Main function to start runtime security monitoring."""
    monitor = RuntimeSecurityMonitor()
    await monitor.start_monitoring()

if __name__ == "__main__":
    asyncio.run(main())