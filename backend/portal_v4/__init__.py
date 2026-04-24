"""
Kundenportal v2 – Standalone-Modul (Module-First)

Komplett isoliert vom alten Portal (routes/portal.py).
Eigene Collections (portal4_*), eigenes Routing (/api/portal-v4/*),
eigenes Feature-Flag (portal4_settings.feature_enabled).

Phase 1: Admin-CRUD + Feature-Flag
"""
from fastapi import APIRouter

from . import routes_admin
from . import sync
from . import routes_customer
from . import messages
from . import uploads
from . import documents

router = APIRouter(prefix="/api/portal-v4", tags=["portal-v4"])
router.include_router(routes_admin.router)
router.include_router(sync.router)
router.include_router(routes_customer.router)
router.include_router(messages.router)
router.include_router(uploads.router)
router.include_router(documents.router)
