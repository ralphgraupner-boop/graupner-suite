"""
Duplikate-Modul (Module-First, 24.04.2026)
==========================================
Eigenstaendiges Modul fuer das Erkennen und manuelle Zusammenfuehren
von Duplikaten in der Kundenliste.

- Liest aus: module_kunden (nur lesend beim Scan)
- Schreibt in:
    - module_kunden (beim Merge – Sieger-Update + Loser-Archivierung)
    - duplikate_ignored       (als "kein Duplikat" markierte Paare)
    - duplikate_merge_log     (Audit-Trail aller Merges)
    - module_duplikate_settings
- API-Prefix: /api/module-duplikate/*
- Feature-Flag: module_duplikate_settings.feature_enabled

Heuristik (User-Wahl A3):
  Duplikat, wenn eines zutrifft:
  - gleiche, nicht leere E-Mail (case-insensitive)
  - gleicher Name UND gleiche PLZ
  - gleicher Name UND gleiche Telefonnummer (normalisiert)

Merge (User-Wahl B3):
  Pro Feld waehlt der Admin manuell, welcher Wert gewinnt.
  Der Verlierer wird NICHT geloescht, sondern auf kontakt_status="Archiv"
  gesetzt mit einer Verschmolzen-Markierung.
"""
from fastapi import APIRouter

from . import routes
from . import settings

router = APIRouter(prefix="/api/module-duplikate", tags=["module-duplikate"])
router.include_router(settings.router)
router.include_router(routes.router)
