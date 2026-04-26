"""
module_termine – Termine als eigenständiges Modul mit Status-Workflow.
Module-First: eigene Collection module_termine, eigenes API-Prefix /api/module-termine.

Status-Workflow:
  wartet_auf_go  → Admin hat Termin angelegt, wartet auf Bestätigung zum Eintrag in Kalender
  bestaetigt     → User hat "GO" geklickt
  im_kalender    → Termin wurde an Google Kalender übertragen
  abgesagt       → Termin storniert
"""
