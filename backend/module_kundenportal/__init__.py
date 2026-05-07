"""Modul: module_kundenportal — Klassisches Kundenportal.

Enthaelt:
  * routes_legacy.py — `/api/portals/*` (Original-Portal)
  * routes_klon.py   — `/api/portal-klon/*` (Arbeitskopie / Test-Sandbox)

Hinweis: Die neueren Versionen `portal_v2`, `portal_v3`, `portal_v4`
liegen weiterhin in eigenen Top-Level-Verzeichnissen — sie wurden bereits
zuvor als Module gefuehrt. Modul-First, siehe VISION.md (07.05.2026).
"""

from fastapi import APIRouter

from .routes_legacy import router as _legacy
from .routes_klon import router as _klon

router = APIRouter()
router.include_router(_legacy)
router.include_router(_klon)

__all__ = ["router"]
