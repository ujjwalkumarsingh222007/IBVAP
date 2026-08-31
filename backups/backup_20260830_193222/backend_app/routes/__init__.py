"""
Routes package for IBVAP backend.
"""

from app.routes.ai import router as ai_router
from app.routes.analytics import router as analytics_router
from app.routes.auth import router as auth_router
from app.routes.cameras import router as cameras_router
from app.routes.dashboard import router as dashboard_router
from app.routes.demo import router as demo_router
from app.routes.events import router as events_router
from app.routes.evidence import router as evidence_router
from app.routes.health import router as health_router
from app.routes.persons import router as persons_router
from app.routes.threats import router as threats_router
from app.routes.vehicles import router as vehicles_router

__all__ = [
    "ai_router",
    "analytics_router",
    "auth_router",
    "cameras_router",
    "dashboard_router",
    "demo_router",
    "events_router",
    "evidence_router",
    "health_router",
    "persons_router",
    "threats_router",
    "vehicles_router",
]
