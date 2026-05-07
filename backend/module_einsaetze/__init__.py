"""Modul: module_einsaetze — Einsatzplanung & Auswahl-Konfiguration.

Enthaelt:
  * Einsatz-CRUD (`/api/einsaetze`)
  * `/api/einsatz-config` — liest/schreibt Reparaturgruppen, Materialien,
    Prioritaeten, Bild-Kategorien LIVE aus `module_textvorlagen`
    (Datenmaske, siehe VISION.md, 06.05.2026).
  * Cleanup-Endpoint fuer alte einsatz_config-Collection.

Modul-First (siehe VISION.md, 07.05.2026): eigener Router, eigenes
Verzeichnis. `server.py` nutzt nur noch `from module_einsaetze import router`.
"""

from .routes import router

__all__ = ["router"]
