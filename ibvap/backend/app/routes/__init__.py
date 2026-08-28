from app.routes.events import router as events_router
from app.routes.cameras import router as cameras_router
from app.routes.alerts import router as alerts_router
from app.routes.watchlist import router as watchlist_router
from app.routes.detections import router as detections_router

__all__ = [
    "events_router",
    "cameras_router",
    "alerts_router",
    "watchlist_router",
    "detections_router",
]
