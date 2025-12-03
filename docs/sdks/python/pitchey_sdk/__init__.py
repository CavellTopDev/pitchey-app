"""
Pitchey Python SDK

Official Python SDK for the Pitchey API - the comprehensive movie pitch platform.

Example:
    ```python
    from pitchey_sdk import PitcheySDK
    
    # Initialize the SDK
    pitchey = PitcheySDK()
    
    # Authenticate
    auth = pitchey.auth.login("user@example.com", "password123")
    
    # Get public pitches
    pitches = pitchey.pitches.get_public(limit=10)
    print(f"Found {len(pitches.data)} pitches")
    ```
"""

from .client import PitcheySDK
from .exceptions import (
    PitcheyError,
    PitcheyAPIError,
    PitcheyAuthenticationError,
    PitcheyAuthorizationError,
    PitcheyNotFoundError,
    PitcheyValidationError,
    PitcheyRateLimitError,
)
from .models import (
    User,
    Pitch,
    Message,
    Notification,
    Investment,
    NDA,
    MediaFile,
    AnalyticsEvent,
)
from .types import (
    UserType,
    PitchFormat,
    PitchVisibility,
    MessageType,
    NotificationType,
    InvestmentStatus,
    NDAStatus,
    MediaType,
)

__version__ = "1.0.0"
__author__ = "Pitchey Development Team"
__email__ = "developers@pitchey.com"
__license__ = "MIT"
__url__ = "https://pitchey.com/developers"

__all__ = [
    # Main SDK class
    "PitcheySDK",
    
    # Exceptions
    "PitcheyError",
    "PitcheyAPIError", 
    "PitcheyAuthenticationError",
    "PitcheyAuthorizationError",
    "PitcheyNotFoundError",
    "PitcheyValidationError",
    "PitcheyRateLimitError",
    
    # Models
    "User",
    "Pitch",
    "Message",
    "Notification",
    "Investment",
    "NDA",
    "MediaFile",
    "AnalyticsEvent",
    
    # Types
    "UserType",
    "PitchFormat",
    "PitchVisibility",
    "MessageType",
    "NotificationType",
    "InvestmentStatus",
    "NDAStatus",
    "MediaType",
]