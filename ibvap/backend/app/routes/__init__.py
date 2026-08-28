"""
Routes package for IBVAP backend.
"""

from app.routes.events import router as events_router

__all__ = ["events_router"]
