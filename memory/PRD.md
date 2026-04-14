# Graupner Suite - PRD

## Original Problem Statement
Handwerker-Verwaltungssoftware ("Graupner Suite") - modularer Aufbau mit eigenstaendigen Bausteinen.

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **Storage**: Emergent Object Storage
- **Auth**: JWT-based (admin/Graupner!Suite2026)
- **Prinzip**: Modulare Architektur - jedes Modul ist eigenstaendig mit eigener DB, API und UI

## Module (Eigenstaendig)

### 1. Kontakt-Modul (Datensammler)
- **Seite**: `/module/kontakt`
- **DB**: `module_kontakt`
- **API**: `/api/modules/kontakt/data`
- **Felder**: Anrede, Vorname, Nachname, Firma, E-Mail, Telefon, Adresse, Status (Anfrage/Kunde/Interessent/Archiv), Kundentyp, Kategorien, Notizen
- **Status**: Fertig

### 2. Artikel & Leistungen
- **Seite**: `/module/artikel`
- **DB**: `module_artikel`, `module_artikel_config`
- **API**: `/api/modules/artikel/data`, `/api/modules/artikel/config`, `/api/modules/artikel/next-number/{typ}`
- **Felder**: Artikel-Nr (auto), Bezeichnung, Beschreibung, Typ (Artikel/Leistung/Fremdleistung), EK-Preis, VK-Preis, Einheit, Subunternehmer
- **Nummernvergabe**: ArtNr2640, Leist2660, Fremd26000 (konfigurierbar)
- **Status**: Fertig

### 3. Dokumente (Angebote, Auftraege, Rechnungen)
- **Seite**: `/module/dokumente`
- **DB**: `quotes`, `orders`, `invoices` (bestehendes System)
- **API**: Bestehende `/api/quotes`, `/api/orders`, `/api/invoices` + `/api/modules/dokumente/stats`
- **Vorschau**: Seitenblaettern, automatische Positionsaufteilung bei langen Texten, manueller Seitenumbruch mit `---`
- **Verknuepfungen**: Kontakt-Modul (Kundenauswahl), Artikel & Leistungen (Positionen), Textvorlagen
- **Status**: Fertig

### 4. Textvorlagen
- **Seite**: `/module/textvorlagen`
- **DB**: `module_textvorlagen`
- **API**: `/api/modules/textvorlagen/data`, `/api/modules/textvorlagen/placeholders`
- **Felder**: Titel, Inhalt, Textart (Vortext/Schlusstext/Betreff/etc.), Dokumenttyp
- **Platzhalter**: {kunde_name}, {datum}, {dokument_nr}, etc.
- **Verknuepfung**: Wird im Dokument-Editor als Textbaustein-Dropdown angezeigt
- **Status**: Fertig

## Modul-Manager
- **Seite**: Einstellungen -> Module Tab
- **Zeigt**: Alle registrierten Module mit Feldern, API-Endpoints, Status
- **Funktionen**: Aktivieren/Deaktivieren, Export

## Bestehendes System (Legacy - wird schrittweise durch Module ersetzt)
- Anfragen-Seite
- Kunden-Seite
- E-Mail (IMAP)
- Dashboard
- Einstellungen
- Mitarbeiter
- Einsaetze

## Completed Work (14.04.2026)
- [x] Vorname/Nachname Trennung in Listen/Detail
- [x] VCF-Import fuer Kunden + Anfragen
- [x] Bilder/Dokumente getrennte Bereiche
- [x] E-Mail-Parser: Kontaktformular-Weiterleitungen
- [x] ContactForm-Modul (gemeinsames Formular)
- [x] Kontakt-Modul (eigenstaendig)
- [x] Artikel & Leistungen Modul mit Nummernvergabe
- [x] Dokumente-Modul (Angebote/Auftraege/Rechnungen)
- [x] Textvorlagen-Modul
- [x] Module verknuepft (Kontakte -> Dokumente, Artikel -> Dokumente, Textvorlagen -> Dokumente)
- [x] Dokument-Vorschau: Seitenblaettern + Positionsaufteilung
- [x] Seitenumbruch-Steuerung mit --- Marker
- [x] Bug-Fixes: PortalButtons Import, AnfrageUpdate Modell, doppelter PUT-Endpoint

## Key Files
- `/app/backend/routes/modules.py` - Modul-Manager API
- `/app/backend/routes/module_artikel.py` - Artikel & Leistungen Backend
- `/app/backend/routes/module_dokumente.py` - Dokumente Backend
- `/app/backend/routes/module_textvorlagen.py` - Textvorlagen Backend
- `/app/frontend/src/pages/KontaktModulPage.jsx` - Kontakt-Modul UI
- `/app/frontend/src/pages/ArtikelModulPage.jsx` - Artikel & Leistungen UI
- `/app/frontend/src/pages/DokumenteModulPage.jsx` - Dokumente UI
- `/app/frontend/src/pages/TextvorlagenModulPage.jsx` - Textvorlagen UI
- `/app/frontend/src/components/DocumentPreview.jsx` - Vorschau mit Seitenblaettern
- `/app/frontend/src/components/ContactForm.jsx` - Gemeinsames Kontaktformular

## P1 - Next Tasks
- [ ] Weitere Module aus bestehendem System extrahieren
- [ ] Alte Seiten schrittweise durch Module ersetzen
- [ ] Redeploy fuer Live-Domain

## P2 - Future/Backlog
- [ ] Standalone Homepage
- [ ] Windows Desktop App (Electron)
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
