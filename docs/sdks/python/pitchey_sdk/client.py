"""
Main Pitchey SDK client class.
"""

from typing import Optional, Dict, Any
import httpx
from .base_client import BaseClient
from .resources import (
    AuthResource,
    PitchesResource,
    UsersResource,
    MessagesResource,
    NotificationsResource,
    InvestmentsResource,
    NDAsResource,
    MediaResource,
    WatchlistResource,
    AnalyticsResource,
    SearchResource,
    SystemResource,
)


class PitcheySDK:
    """
    Main Pitchey SDK class for interacting with the Pitchey API.
    
    This class provides access to all API resources and manages authentication,
    error handling, and request/response processing.
    
    Args:
        api_url: Base URL for the Pitchey API
        api_key: Optional API key for authentication
        timeout: Request timeout in seconds
        retries: Number of retry attempts for failed requests
        debug: Enable debug logging
        
    Example:
        ```python
        from pitchey_sdk import PitcheySDK
        
        # Initialize with default settings
        pitchey = PitcheySDK()
        
        # Initialize with custom settings
        pitchey = PitcheySDK(
            api_url="https://api.pitchey.com",
            api_key="your-api-key",
            timeout=30.0,
            debug=True
        )
        
        # Authenticate
        auth = pitchey.auth.login("user@example.com", "password")
        print(f"Logged in as: {auth.user.username}")
        
        # Get public pitches
        pitches = pitchey.pitches.get_public(limit=10)
        for pitch in pitches.data:
            print(f"- {pitch.title} by {pitch.user.username}")
        ```
    """
    
    def __init__(
        self,
        api_url: str = "https://pitchey-production.cavelltheleaddev.workers.dev",
        api_key: Optional[str] = None,
        timeout: float = 30.0,
        retries: int = 3,
        debug: bool = False,
        **kwargs
    ):
        # Initialize the base HTTP client
        self._client = BaseClient(
            api_url=api_url,
            api_key=api_key,
            timeout=timeout,
            retries=retries,
            debug=debug,
            **kwargs
        )
        
        # Initialize resource instances
        self.auth = AuthResource(self._client)
        self.pitches = PitchesResource(self._client)
        self.users = UsersResource(self._client)
        self.messages = MessagesResource(self._client)
        self.notifications = NotificationsResource(self._client)
        self.investments = InvestmentsResource(self._client)
        self.ndas = NDAsResource(self._client)
        self.media = MediaResource(self._client)
        self.watchlist = WatchlistResource(self._client)
        self.analytics = AnalyticsResource(self._client)
        self.search = SearchResource(self._client)
        self.system = SystemResource(self._client)
    
    def set_api_key(self, api_key: str) -> None:
        """
        Set the API key for authenticated requests.
        
        Args:
            api_key: The API key to use for authentication
        """
        self._client.set_api_key(api_key)
    
    def get_api_key(self) -> Optional[str]:
        """
        Get the current API key.
        
        Returns:
            The current API key, or None if not set
        """
        return self._client.get_api_key()
    
    def clear_api_key(self) -> None:
        """Clear the current API key."""
        self._client.clear_api_key()
    
    def is_authenticated(self) -> bool:
        """
        Check if the SDK is authenticated.
        
        Returns:
            True if an API key is set, False otherwise
        """
        return self.auth.is_authenticated()
    
    async def login(self, email: str, password: str) -> Dict[str, Any]:
        """
        Quick login helper - auto-detects user type.
        
        Args:
            email: User email address
            password: User password
            
        Returns:
            Authentication response with token and user data
        """
        return await self.auth.login(email, password)
    
    def logout(self) -> None:
        """Logout and clear the stored API key."""
        self.auth.logout()
    
    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.close()
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()
    
    # ============================================================================
    # Factory methods for common use cases
    # ============================================================================
    
    @classmethod
    def production(cls, api_key: Optional[str] = None) -> "PitcheySDK":
        """
        Create an SDK instance configured for production use.
        
        Args:
            api_key: Optional API key for authentication
            
        Returns:
            Configured PitcheySDK instance
        """
        return cls(
            api_url="https://pitchey-production.cavelltheleaddev.workers.dev",
            api_key=api_key,
            debug=False,
        )
    
    @classmethod
    def development(cls, api_key: Optional[str] = None) -> "PitcheySDK":
        """
        Create an SDK instance configured for development use.
        
        Args:
            api_key: Optional API key for authentication
            
        Returns:
            Configured PitcheySDK instance
        """
        return cls(
            api_url="http://localhost:8001",
            api_key=api_key,
            debug=True,
        )
    
    @classmethod
    async def demo(cls, user_type: str = "creator") -> "PitcheySDK":
        """
        Create an SDK instance with demo account authentication.
        
        Args:
            user_type: Type of demo account ('creator', 'investor', 'production')
            
        Returns:
            Authenticated PitcheySDK instance
        """
        sdk = cls.production()
        
        # Login with appropriate demo account
        if user_type == "creator":
            await sdk.auth.login_demo_creator()
        elif user_type == "investor":
            await sdk.auth.login_demo_investor()
        elif user_type == "production":
            await sdk.auth.login_demo_production()
        else:
            raise ValueError(f"Invalid demo user type: {user_type}")
        
        return sdk
    
    @classmethod
    def public(cls) -> "PitcheySDK":
        """
        Create an SDK instance for public (unauthenticated) use.
        
        Returns:
            PitcheySDK instance without authentication
        """
        return cls(
            api_url="https://pitchey-production.cavelltheleaddev.workers.dev",
            debug=False,
        )