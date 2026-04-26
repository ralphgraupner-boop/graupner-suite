"""
Kundenportal v2 – Standalone-Modul (Module-First)

Komplett isoliert vom alten Portal (routes/portal.py).
Eigene Collections (portal2_*), eigenes Routing (/api/portal-v2-klon/*),
eigenes Feature-Flag (portal2klon_settings.feature_enabled).

Phase 1: Admin-CRUD + Feature-Flag
"""
from fastapi import APIRouter

from . import routes_admin
from . import sync
from . import routes_customer
from . import messages
from . import uploads

router = APIRouter(prefix="/api/portal-v2-klon", tags=["portal-v2-klon"])
router.include_router(routes_admin.router)
router.include_router(sync.router)
router.include_router(routes_customer.router)
router.include_router(messages.router)
router.include_router(uploads.router)
