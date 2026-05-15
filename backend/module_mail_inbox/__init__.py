"""
module_mail_inbox – Jimdo-Kontaktformular-Anfragen aus mehreren IMAP-Postfächern
einlesen und als Kunden-Vorschläge anbieten.

Module-First, eigenes Prefix /api/module-mail-inbox.

Routen aufgeteilt in 5 Sub-Module (15.05.2026):
    routes_scan     – IMAP-Scan, Scan-Preview, Mail-Import
    routes_list     – Liste, Stats, Detail-Ansicht, Kunden-Mails
    routes_actions  – Akzeptieren, Verknüpfen, Ablehnen, Abschliessen
    routes_delete   – Löschen (einzeln, bulk, alle Spam)
    routes_admin    – Spam-Reevaluierung, Daten-Migration
"""
from fastapi import APIRouter

from .routes_scan import router as scan_router
from .routes_list import router as list_router
from .routes_actions import router as actions_router
from .routes_delete import router as delete_router
from .routes_admin import router as admin_router
from .accounts import router as accounts_router

router = APIRouter()
router.include_router(scan_router)
router.include_router(list_router)
router.include_router(actions_router)
router.include_router(delete_router)
router.include_router(admin_router)
router.include_router(accounts_router)

__all__ = ["router"]
