"""
Projekte-Modul (Module-First, 25.04.2026)
=========================================
Eigenständiges Modul für Kunden-Projekte (Akten/Vorgänge).

Beispiel: Kundin Lina Scherer hat 2 Projekte:
  - Projekt 1 (2026): Innentür reparieren
  - Projekt 2 (2027): Haustür erneuern

- Liest aus: module_kunden (nur lesend, fuer Kunden-Picker)
- Schreibt in:
    - module_projekte
    - module_projekte_settings
- API-Prefix: /api/module-projekte/*
- Feature-Flag: module_projekte_settings.feature_enabled

Phase 1 (heute): CRUD + Bilder + Status, Admin-Bereich.
Phase 2 (spaeter): Portal v4 Anbindung (read-only fuer Kunden).
"""
from fastapi import APIRouter

from . import routes
from . import settings

router = APIRouter(prefix="/api/module-projekte", tags=["module-projekte"])
router.include_router(settings.router)
router.include_router(routes.router)
