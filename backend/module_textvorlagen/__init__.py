"""Modul: module_textvorlagen — Source of Truth fuer Auswahlfelder & Texte.

Datenmaske, siehe VISION.md (06./07.05.2026):
Alle Auswahlfelder (Kunden-Status, Kategorien, Anreden, Reparaturgruppen,
Materialien, Prioritaeten, Bild-Kategorien, Aufgaben-Kategorien …) werden
ausschliesslich hier mit eigenem doc_type gepflegt.
"""

from .routes import router

__all__ = ["router"]
