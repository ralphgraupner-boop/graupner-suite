"""
Monteur-App Modul (Module-First, 24.04.2026)
=============================================
Eigenständiges Modul für die mobile Monteur-Ansicht.
- Liest aus: einsaetze, module_kunden (nur lesend)
- Schreibt in: monteur_app_notizen, monteur_app_fotos, monteur_app_settings
- API-Prefix: /api/monteur/*
- Feature-Flag: monteur_app_settings.feature_enabled
"""
from fastapi import APIRouter

from . import routes
from . import settings

router = APIRouter(prefix="/api/monteur", tags=["monteur-app"])
router.include_router(settings.router)
router.include_router(routes.router)
