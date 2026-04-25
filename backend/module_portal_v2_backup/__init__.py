"""
Portal-v2-Backup-Modul (Module-First, 25.04.2026)
=================================================
Erstellt Snapshots der portal_v2-Daten (Accounts, Messages, Uploads, Settings).

- Liest read-only aus: portal2_accounts, portal2_messages, portal2_uploads, portal2_settings
- Schreibt in: portal_v2_backups (eigene Collection mit kompletten Snapshot-Dokumenten)
- API-Prefix: /api/module-portal-v2-backup/*
- Retention: 30 Tage (aelter wird automatisch geloescht)
- Auto-Backup: taeglich 03:00 (Background-Task in Server-Startup)
"""
from fastapi import APIRouter

from . import routes

router = APIRouter(prefix="/api/module-portal-v2-backup", tags=["portal-v2-backup"])
router.include_router(routes.router)
