"""
module_mail_inbox – Jimdo-Kontaktformular-Anfragen aus mehreren IMAP-Postfächern
einlesen und als Kunden-Vorschläge anbieten.

Module-First, eigenes Prefix /api/module-mail-inbox.
"""
from fastapi import APIRouter

from .routes import router as scan_router
from .accounts import router as accounts_router

router = APIRouter()
router.include_router(scan_router)
router.include_router(accounts_router)

__all__ = ["router"]
