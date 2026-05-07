"""Modul: module_kunden — Kundenverwaltung (Datenmaske, Source of Truth).

Bündelt die beiden frueher getrennten Router:
  * `routes_legacy.py`  — alte Endpunkte unter `/api/customers/*`
                           (VCF-Import, klassische CRUD, Datei-Upload).
  * `routes_data.py`    — moderne Endpunkte unter `/api/modules/kunden/*`
                           (Duplikate-Check, Anrede-Detection, Migration,
                           neuer Datenmaskenbau).

Der zusammengefuehrte Router wird in `server.py` einmal eingehaengt:
    from module_kunden import router as kunden_router
    api_router.include_router(kunden_router)

Damit ist die Kundenverwaltung erstmals **ein** Modul mit eigenem
Verzeichnis (Modul-First, siehe VISION.md, 07.05.2026).
"""

from fastapi import APIRouter

from .routes_legacy import router as _legacy_router
from .routes_data import router as _data_router

# Re-Export der Hilfsfunktionen, die anderswo gebraucht werden
from .routes_data import auto_sync_kontakt_status_on_startup  # noqa: F401

router = APIRouter()
router.include_router(_legacy_router)
router.include_router(_data_router)

__all__ = ["router", "auto_sync_kontakt_status_on_startup"]
