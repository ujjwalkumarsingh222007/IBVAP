"""
Routes package for IBVAP backend.
"""

from app.routes.analytics import router as analytics_router
from app.routes.cameras import router as cameras_router
from app.routes.dashboard import router as dashboard_router
from app.routes.events import router as events_router
from app.routes.health import router as health_router

__all__ = [
    "analytics_router",
    "cameras_router",
    "dashboard_router",
    "events_router",
    "health_router",
]
