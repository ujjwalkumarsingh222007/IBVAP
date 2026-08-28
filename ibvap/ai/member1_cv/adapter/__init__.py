"""
adapter package — Phase 1D: Backend event integration.

Exports EventClient — the only component that knows about HTTP and
the IBVAP Common Event schema.

Everything else in member1_cv (detection, tracking, intrusion) remains
completely backend-agnostic.
"""

from .event_client import EventClient, SendResult

__all__ = ["EventClient", "SendResult"]
