"""Modul: module_dokumente — Dokumentverwaltung & Vorlagen.

Enthaelt vier Routendateien:
  * routes_legacy.py    — `/api/documents/*` (alt-API)
  * routes_manager.py   — `/api/documents-manager/*` (Verwaltung)
  * routes_templates.py — `/api/document-templates/*` (Vorlagen)
  * routes_data.py      — `/api/modules/dokumente/*` (modern, Datenmaske)

Modul-First (siehe VISION.md, 07.05.2026).
"""

from fastapi import APIRouter

from .routes_legacy import router as _legacy
from .routes_manager import router as _manager
from .routes_templates import router as _templates
from .routes_data import router as _data

router = APIRouter()
router.include_router(_legacy)
router.include_router(_manager)
router.include_router(_templates)
router.include_router(_data)

__all__ = ["router"]
