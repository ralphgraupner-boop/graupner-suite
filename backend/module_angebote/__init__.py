"""Modul: module_angebote — Angebotsverwaltung.

Enthaelt CRUD-Endpunkte unter `/api/quotes/*` sowie die Hilfsfunktion
`find_customer_in_modules`, die auch von Auftraegen und Rechnungen
verwendet wird (Cross-Modul-Helper, siehe Datenmaske).
"""

from .routes import router, find_customer_in_modules

__all__ = ["router", "find_customer_in_modules"]
