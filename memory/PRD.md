# Graupner Suite - PRD

## Original Problem Statement
Handwerker-Verwaltungssoftware ("Graupner Suite") mit folgenden Kernfunktionen:
- Kundenverwaltung, Anfragenverwaltung, Angebote, Auftraege, Rechnungen
- IMAP E-Mail-Integration, Kontaktformular-Webhooks
- Drag-and-Drop Datei-Uploads (max 10 Dateien)
- Separate Felder: Anrede, Vorname, Nachname, Firma

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **Storage**: Emergent Object Storage (via utils/storage.py)
- **Auth**: JWT-based (admin/Graupner!Suite2026)

## Completed Features
- [x] Kundenverwaltung (CRUD, Kategorien, Status)
- [x] Anfragenverwaltung (CRUD, Kategorien, Bearbeitungsstatus)
- [x] IMAP E-Mail-Integration
- [x] Kontaktformular-Webhooks
- [x] Datei-Upload (max 10) fuer Kunden und Anfragen
- [x] Felder Anrede, Vorname, Nachname, Firma (Backend + Frontend)
- [x] Vorname/Nachname getrennt in Listen-/Detailansichten (14.04.2026)
- [x] Anfragen Bearbeiten-Modal mit Anrede/Vorname/Nachname Feldern (14.04.2026)
- [x] Suchfilter fuer Vorname/Nachname (14.04.2026)
- [x] Legacy-Daten Fallback (alte "name"-Eintraege werden korrekt angezeigt)
- [x] Daten-Migration: Bestehende name-Felder in vorname/nachname aufgeteilt (14.04.2026)
- [x] Backend: Auto-Generierung von name aus vorname+nachname beim Update (14.04.2026)
- [x] VCF-Import: Vorname/Nachname/Anrede werden jetzt separat gespeichert (14.04.2026)
- [x] IMAP VCF-Parser: Vorname/Nachname/Anrede Extraktion hinzugefuegt (14.04.2026)
- [x] VCF-Import auf Kunden-Seite hinzugefuegt (14.04.2026)
- [x] Photos-Modell: List[Any] statt List[str] fuer Datei-Metadaten (14.04.2026)
- [x] Anfragen Bearbeiten-Modal komplett umgebaut wie Kunden-Formular (14.04.2026)
  - Adresse in Einzelfelder (Strasse/Nr/PLZ/Ort), Kundentyp-Dropdown, Datei-Upload
- [x] Bilder/Dokumente getrennte Bereiche in Kunden + Anfragen Detailansicht (14.04.2026)
  - Bilder: Thumbnail-Grid mit Hover-Zoom (scale 110%)
  - Dokumente: Dateiliste mit Download-Icon
- [x] Einstellungen/Diverses Tab Crash behoben

## P1 - Next Tasks
- [ ] User informieren ueber Redeploy fuer Live-Domain
- [ ] Standalone Homepage fertigstellen (/app/landing_page/index.html)

## P2 - Future/Backlog
- [ ] Windows Desktop App (Electron Wrapper)
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Refactoring: Grosse Komponenten aufteilen (SettingsPage, AnfragenPage, CustomersPage >1300 Zeilen)

## Key Files
- `/app/frontend/src/pages/CustomersPage.jsx`
- `/app/frontend/src/pages/AnfragenPage.jsx`
- `/app/backend/models.py`
- `/app/backend/routes/customers.py`
- `/app/backend/routes/anfragen.py`

## DB Schema
- `customers`: {vorname, nachname, anrede, firma, photos, email, phone, address, ...}
- `anfragen`: {vorname, nachname, anrede, firma, photos, email, phone, address, ...}
