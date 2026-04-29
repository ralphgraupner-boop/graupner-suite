"""
module_export – Kunden-Komplett-Export & Re-Import als ZIP.

Module-First:
- Eigener Ordner /app/backend/module_export/
- Eigenes Prefix /api/module-export
- Liest aus mehreren Collections (read-only Datenmaske), schreibt beim Import in dieselben Collections mit neu vergebenen IDs.
- Schreibt eigene Log-Collection module_export_log (Audit, wer/wann/was).

Ziel: Kunde + alle relationalen Daten (Projekte, Aufgaben, Termine, Einsätze, Quotes,
Rechnungen, Portale, Monteur-App-Notizen/Fotos/Todos, Dateien aus Object-Storage)
verlustfrei exportieren UND wieder einlesen.
"""
