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
- **Felder**: Anrede, Vorname, Nachname, Firma, E-Mail, Telefon, Adresse, Status, Kundentyp, Kategorien, Notizen
- **Status**: Fertig

### 2. Artikel & Leistungen
- **Seite**: `/module/artikel`
- **DB**: `module_artikel`, `module_artikel_config`
- **API**: `/api/modules/artikel/data`, `/api/modules/artikel/config`, `/api/modules/artikel/next-number/{typ}`
- **Felder**: Artikel-Nr (auto), Bezeichnung, Beschreibung, Typ, EK-Preis, VK-Preis, Einheit, Subunternehmer
- **Nummernvergabe**: ArtNr2640, Leist2660, Fremd26000 (konfigurierbar)
- **Status**: Fertig

### 3. Dokumente (Angebote, Auftraege, Rechnungen)
- **Seite**: `/module/dokumente`
- **DB**: `quotes`, `orders`, `invoices`
- **API**: Bestehende `/api/quotes`, `/api/orders`, `/api/invoices` + `/api/modules/dokumente/stats`
- **Vorschau**: Seitenblaettern, automatische Positionsaufteilung, Seitenumbruch mit `---`
- **Status**: Fertig

### 4. Textvorlagen
- **Seite**: `/module/textvorlagen`
- **DB**: `module_textvorlagen`
- **API**: `/api/modules/textvorlagen/data`, `/api/modules/textvorlagen/placeholders`
- **Felder**: Titel, Inhalt, Textart, Dokumenttyp
- **Status**: Fertig

### 5. Kunden-Modul
- **Seite**: `/module/kunden`
- **DB**: `module_kunden`
- **API**: `/api/modules/kunden/data`, `/api/modules/kunden/import-vcf`, `/api/modules/kunden/export`
- **Felder**: Anrede, Vorname, Nachname, Firma, E-Mail, Telefon, Strasse, Hausnummer, PLZ, Ort, Kundentyp, Status, Kategorien, Notizen, Dateien (max 10)
- **Features**: CRUD, VCF-Import, Datei-Upload (Drag&Drop, Bilder/Dokumente getrennt), Google Maps Link, Suche, Filter, Export
- **Status**: Fertig (15.04.2026)

## Modul-Manager
- **Seite**: Einstellungen -> Module Tab
- **Zeigt**: Alle registrierten Module mit Feldern, API-Endpoints, Status

## Bestehendes System (Legacy - ENTFERNT aus Navigation 15.04.2026)
Alte Seiten existieren noch im Code als Dateien, sind aber nicht mehr erreichbar:
- Anfragen, alte Kunden, alte Artikel, Einsatzplanung, Buchhaltung, Mahnwesen, Mitarbeiter, Kundenportale, Website-Integration

## Oberste Regel
Module erstellen -> dann verknuepfen. Jedes Modul sammelt/speichert zuerst Daten eigenstaendig.

## Modul-Verknuepfungen (Fertig 15.04.2026)
1. **Kontakt -> Kunden**: Button "Als Kunde uebernehmen" im Kontakt-Detail. Duplikat-Erkennung per E-Mail/Name.
2. **Kunden -> Kontakt**: Button "Ins Kontakt-Modul" im Kunden-Detail. Duplikat-Erkennung per E-Mail/Name.
3. **Kunden-Modul -> Dokumente**: Kunden aus Kunden-Modul erscheinen im Dokument-Editor Dropdown mit [Kunden-Modul] Label.
4. **Artikel -> Dokumente**: Artikel & Leistungen Modul liefert Positionen an den Dokument-Editor.
5. **Textvorlagen -> Dokumente**: Textvorlagen-Modul liefert Textbausteine (Vortext/Schlusstext/Betreff) an den Dokument-Editor.

## Lohnanteil (Fertig 15.04.2026)
- Jede Position hat ein "Lohnanteil" Feld (netto pro Einheit)
- Automatische Summe aller Lohnanteile (Menge x Lohnanteil)
- Freier Wert moeglich (statt automatische Summe)
- Steuerung: "Wird ausgewiesen" / "Nicht ausweisen" Button
- Textvorlagen-Platzhalter: {lohnanteil}, {lohnanteil_mwst}, {lohnanteil_brutto}, {mwst_satz}
- MwSt-Satz aus Einstellungen (konfigurierbar)
- Beispiel-Schlusstext: "Enthalten ist ein Lohnanteil von {lohnanteil} zzgl. {mwst_satz} MwSt (= {lohnanteil_mwst}). Dies ergibt eine Gesamt-Lohnsumme von {lohnanteil_brutto}."

- [ ] ERR_BLOCKED_BY_CLIENT Bug fixen (Dokumente oeffnen)
- [ ] Redeploy fuer Live-Domain

## P2 - Future/Backlog
- [ ] Standalone Homepage
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Windows Desktop App (Electron)
- [ ] Alte Legacy-Seiten schrittweise ersetzen

## Key Files
- `/app/backend/routes/module_kunden.py` - Kunden-Modul Backend
- `/app/frontend/src/pages/KundenModulPage.jsx` - Kunden-Modul UI
- `/app/backend/routes/modules.py` - Modul-Manager API
- `/app/backend/routes/module_artikel.py` - Artikel Backend
- `/app/backend/routes/module_dokumente.py` - Dokumente Backend
- `/app/backend/routes/module_textvorlagen.py` - Textvorlagen Backend
- `/app/frontend/src/components/DocumentPreview.jsx` - Vorschau
- `/app/frontend/src/components/ContactForm.jsx` - Gemeinsames Kontaktformular
