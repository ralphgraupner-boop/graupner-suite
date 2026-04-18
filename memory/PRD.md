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

### 1. Kontakt-Modul
- **Seite**: `/module/kontakt`
- **DB**: `module_kontakt`
- **API**: `/api/modules/kontakt/data`
- **Status**: Fertig

### 2. Artikel & Leistungen
- **Seite**: `/module/artikel`
- **DB**: `module_artikel`, `module_artikel_config`
- **API**: `/api/modules/artikel/data`
- **Status**: Fertig

### 3. Dokumente (Angebote, Auftraege, Rechnungen)
- **Seite**: `/module/dokumente`
- **API**: `/api/quotes`, `/api/orders`, `/api/invoices`
- **Status**: Fertig

### 4. Textvorlagen
- **Seite**: `/module/textvorlagen`
- **DB**: `module_textvorlagen`
- **API**: `/api/modules/textvorlagen/data`
- **Features**: Rich-Text-Editor (fett, kursiv, unterstrichen, Farbe), Split-Overlay im Dokument-Editor
- **Status**: Fertig

### 5. Kunden-Modul
- **Seite**: `/module/kunden`
- **DB**: `module_kunden`
- **API**: `/api/modules/kunden/data`
- **Status**: Fertig

### 6. Kundenportal (18.04.2026)
- **Admin-Seite**: `/portals`
- **Kunden-Seite**: `/portal/:token` (oeffentlich, ohne Auth)
- **DB**: `portals`, `portal_files`
- **API**: `/api/portals/*`, `/api/portal/*`
- **Features**: Passwortgeschuetzte Kundenportale, bidirektionaler Datei-Upload, Nachrichten-System, Admin-Textbausteine, E-Mail-Einladungen, Portal-Verwaltung, Passwort-Export
- **Status**: Fertig (100% getestet)

### 7. Kontaktformular (Standalone) (18.04.2026)
- **Inline-Seite**: `/api/kontakt` (ohne Auth, oeffentlich)
- **Standalone-HTML**: `/app/landing_page/kontaktformular.html` (fuer IONOS-Upload)
- **API**: `/api/kontakt/submit` (multipart POST), `/api/webhook/contact` (JSON), `/api/webhook/contact-beacon` (GET pixel)
- **Speichert in**: `module_kontakt` Collection (NICHT mehr legacy `anfragen`)
- **Features**: 4-Schritt-Wizard, Drag&Drop Bild-Upload, Objektadresse, Kategorien, E-Mail-Benachrichtigung (Admin + Kunde), Bestaetigungsseite
- **Status**: Fertig (100% getestet - 18/18 Backend-Tests)

## Modul-Verknuepfungen
1. Kontakt <-> Kunden: Bidirektionaler Transfer
2. Kunden-Modul -> Dokumente: Kunden im Editor Dropdown
3. Artikel -> Dokumente: Positionen im Editor
4. Textvorlagen -> Dokumente: Textbausteine im Editor (Overlay mit Neu-Erstellen)
5. Kunden-Modul -> Kundenportal: Portal direkt aus Kunde erstellen
6. Kontakt-Modul -> Kundenportal: Portal aus Kontakt erstellen
7. Kontaktformular -> Kontakt-Modul: Externe Anfragen landen direkt im Kontakt-Modul

## Lohnanteil
- Jede Position hat ein "Lohnanteil" Feld (netto pro Einheit)
- Automatische Summe (Menge x Lohnanteil)
- Steuerung: "Wird ausgewiesen" / "Nicht ausweisen"
- Platzhalter: {lohnanteil}, {lohnanteil_mwst}, {lohnanteil_brutto}, {mwst_satz}

## Legacy-System (aus Navigation entfernt)
- Alte Seiten in _legacy_backup/, nicht mehr erreichbar
- Navigation: Dashboard, Module, Kundenportale, E-Mail, Einstellungen
- Alle Webhooks/Formulare speichern jetzt in module_kontakt (nicht mehr anfragen)

## P1 - Next Tasks
- [x] Kundenportal-Modul installieren und integrieren (18.04.2026)
- [x] Kontaktformular-Modul installieren und auf module_kontakt umstellen (18.04.2026)
- [ ] Redeploy fuer Live-Domain

## P2 - Future/Backlog
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Handy-App Ueberlegungen
- [ ] Standalone Homepage fertigstellen
- [ ] Windows Desktop App (Electron)
- [ ] IONOS MariaDB Integration (pausiert)
- [ ] Standalone-Kontaktformular auf IONOS hochladen (via FileZilla)
