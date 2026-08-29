"""
IBVAP - Member 2 ANPR Adapter Package.
Provides HTTP event forwarding to Member 3 Backend API.
"""

from .event_client import (
    ANPREventClient,
    SendResult,
    DEFAULT_BACKEND_URL,
    EVENTS_ENDPOINT,
    DEFAULT_CAMERA_ID,
    DEFAULT_TIMEOUT_SECS,
)

__all__ = [
    "ANPREventClient",
    "SendResult",
    "DEFAULT_BACKEND_URL",
    "EVENTS_ENDPOINT",
    "DEFAULT_CAMERA_ID",
    "DEFAULT_TIMEOUT_SECS",
]
