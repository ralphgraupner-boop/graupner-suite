"""
module_kunde_delete – Sicheres Cascade-Löschen mit Vorab-Export.

Module-First, eigenes Prefix /api/module-kunde-delete.
Schreibt eigenes Audit-Log: module_kunde_delete_log.

Workflow:
1. GET /preview/{id}   → was wird mitgelöscht (gleiche Maske wie module_export.preview)
2. POST /execute/{id}  → erstellt Backup-ZIP (zwingend), löscht alle Verweise, gibt ZIP zurück
                         optional: zusätzlich per Mail an admin senden
"""
from .routes import router

__all__ = ["router"]
