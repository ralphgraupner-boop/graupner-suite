"""
module_health – Status- und Aktualitäts-Check.
Read-only, prefix /api/module-health.
"""
from .routes import router

__all__ = ["router"]
