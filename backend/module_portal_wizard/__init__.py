"""Modul: module_portal_wizard — Neues, schlankes Kundenportal-Fundament.

Eigenstaendiges Modul (Module-First). Verwaltet einmalige Portal-Links, ueber
die Kunden Nachricht/Fotos zu einem Auftrag einreichen koennen.

Collection: module_portal_wizard
Endpunkte:  /api/kundenportal/*

Hinweis: Das alte `module_kundenportal` (routes_legacy/routes_klon) bleibt
unangetastet und wird hier bewusst NICHT genutzt.
"""

from .routes import router

__all__ = ["router"]
