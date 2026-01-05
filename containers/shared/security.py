"""Shared security utilities for container services."""
import os
import hashlib
import secrets
import logging
from typing import Dict, Optional, List
from functools import wraps
import jwt
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class SecurityManager:
    """Common security functionality for all containers."""
    
    def __init__(self):
        self.jwt_secret = os.getenv('JWT_SECRET', secrets.token_urlsafe(32))
        self.api_keys = self._load_api_keys()
        
    def _load_api_keys(self) -> Dict[str, str]:
        """Load API keys from environment."""
        keys = {}
        for key, value in os.environ.items():
            if key.startswith('API_KEY_'):
                service_name = key[8:].lower()  # Remove 'API_KEY_' prefix
                keys[service_name] = value
        return keys
        
    def validate_api_key(self, provided_key: str, service: str = 'default') -> bool:
        """Validate API key for service access."""
        expected_key = self.api_keys.get(service)
        if not expected_key:
            logger.warning(f"No API key configured for service: {service}")
            return False
            
        # Use constant-time comparison to prevent timing attacks
        return secrets.compare_digest(provided_key, expected_key)
        
    def generate_jwt(self, payload: Dict, expires_in: int = 3600) -> str:
        """Generate JWT token with expiration."""
        payload['exp'] = datetime.utcnow() + timedelta(seconds=expires_in)
        payload['iat'] = datetime.utcnow()
        return jwt.encode(payload, self.jwt_secret, algorithm='HS256')
        
    def validate_jwt(self, token: str) -> Optional[Dict]:
        """Validate and decode JWT token."""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            return None
        except jwt.InvalidTokenError:
            logger.warning("Invalid JWT token")
            return None
            
    def hash_file(self, file_path: str) -> str:
        """Generate SHA-256 hash of file for integrity checking."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

def require_auth(security_manager: SecurityManager):
    """Decorator for endpoints requiring authentication."""
    def decorator(func):
        @wraps(func)
        async def wrapper(request, *args, **kwargs):
            # Check API key in headers
            api_key = request.headers.get('X-API-Key')
            if api_key and security_manager.validate_api_key(api_key):
                return await func(request, *args, **kwargs)
                
            # Check JWT token
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
                payload = security_manager.validate_jwt(token)
                if payload:
                    request.user = payload
                    return await func(request, *args, **kwargs)
                    
            return {"error": "Authentication required"}, 401
        return wrapper
    return decorator

class ResourceLimiter:
    """Resource usage limits and monitoring."""
    
    def __init__(self):
        self.max_file_size = int(os.getenv('MAX_FILE_SIZE', 100 * 1024 * 1024))  # 100MB
        self.max_processing_time = int(os.getenv('MAX_PROCESSING_TIME', 300))  # 5 minutes
        self.allowed_extensions = self._get_allowed_extensions()
        
    def _get_allowed_extensions(self) -> List[str]:
        """Get allowed file extensions from environment."""
        extensions = os.getenv('ALLOWED_EXTENSIONS', '.mp4,.mov,.avi,.pdf,.doc,.docx,.txt')
        return [ext.strip() for ext in extensions.split(',')]
        
    def validate_file(self, filename: str, file_size: int) -> tuple[bool, str]:
        """Validate file against security constraints."""
        # Check file size
        if file_size > self.max_file_size:
            return False, f"File too large: {file_size} bytes (max: {self.max_file_size})"
            
        # Check extension
        file_ext = os.path.splitext(filename)[1].lower()
        if file_ext not in self.allowed_extensions:
            return False, f"File type not allowed: {file_ext}"
            
        # Check for suspicious filenames
        suspicious_patterns = ['..', '/', '\\', '<', '>', '|', '*', '?', ':']
        if any(pattern in filename for pattern in suspicious_patterns):
            return False, "Suspicious filename detected"
            
        return True, "Valid file"