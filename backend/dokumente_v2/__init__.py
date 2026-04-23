"""
Dokumente v2 – Modul-First, strikt isoliert von bestehenden
Dokumente-Modulen (routes/documents.py, quotes.py, orders.py, invoices.py, rechnungen_v2.py).

Eigene Collections: dokumente_v2, dokumente_v2_counters, dokumente_v2_counter_log, dokumente_v2_settings
Eigenes API-Prefix: /api/dokumente-v2/*
Eigenes Feature-Flag: dokumente_v2_settings.feature_enabled

Phase 1: Gerüst + CRUD + Feature-Flag + Nummerngenerator
"""
from fastapi import APIRouter

from . import routes_admin
from . import numbers

router = APIRouter(prefix="/api/dokumente-v2", tags=["dokumente-v2"])
router.include_router(routes_admin.router)
router.include_router(numbers.router)
