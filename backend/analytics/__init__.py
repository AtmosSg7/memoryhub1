"""CRM Analytics package."""

from analytics.cache import invalidate_user
from analytics.routes import analytics_router

__all__ = ["analytics_router", "invalidate_user"]
