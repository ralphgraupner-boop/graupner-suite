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

### 6. Kundenportal (NEU 18.04.2026)
- **Admin-Seite**: `/portals`
- **Kunden-Seite**: `/portal/:token` (oeffentlich, ohne Auth)
- **DB**: `portals`, `portal_files`
- **API**: `/api/portals/*`, `/api/portal/*`
- **Features**: Passwortgeschuetzte Kundenportale, bidirektionaler Datei-Upload, Nachrichten-System, Admin-Textbausteine, E-Mail-Einladungen, Portal-Verwaltung, Passwort-Export
- **Status**: Fertig (100% getestet - 26/26 Backend + alle Frontend-Tests bestanden)

## Modul-Verknuepfungen (Fertig 15.04.2026)
1. Kontakt <-> Kunden: Bidirektionaler Transfer
2. Kunden-Modul -> Dokumente: Kunden im Editor Dropdown
3. Artikel -> Dokumente: Positionen im Editor
4. Textvorlagen -> Dokumente: Textbausteine im Editor (Overlay mit Neu-Erstellen)
5. Kunden-Modul -> Kundenportal: Portal direkt aus Kunde erstellen (from-customer)
6. Kontakt-Modul -> Kundenportal: Portal aus Kontakt/Anfrage erstellen (from-anfrage)

## Lohnanteil (15.04.2026)
- Jede Position hat ein "Lohnanteil" Feld (netto pro Einheit)
- Automatische Summe (Menge x Lohnanteil)
- Freier Wert moeglich
- Steuerung: "Wird ausgewiesen" / "Nicht ausweisen"
- Platzhalter: {lohnanteil}, {lohnanteil_mwst}, {lohnanteil_brutto}, {mwst_satz}
- MwSt-Satz aus Einstellungen konfigurierbar
- Gilt fuer Angebot, Auftragsbestaetigung UND Rechnung (ueberall erfassbar und testbar)
- Im Endtext der Rechnung wird der Lohnanteil-Text eingefuegt

## Legacy-System (aus Navigation entfernt)
- Alte Seiten existieren noch als Dateien in _legacy_backup/, sind aber nicht mehr erreichbar
- Navigation zeigt nur: Dashboard, Module, Kundenportale, E-Mail, Einstellungen

## Alle APIs auf Module umgestellt
- Dokument-Editor: nur Modul-Daten (kein Legacy)
- E-Mail-Posteingang: Klassifizierung + Auto-Import ins Kontakt-Modul
- Dashboard: Zeigt Modul-Daten (Kontakt-Modul Anfragen + Kunden-Modul)
- Portal-System: Nutzt module_kunden + module_kontakt (kein Legacy db.customers/db.anfragen)

## P1 - Next Tasks
- [x] Kundenportal-Modul installieren und integrieren (18.04.2026)
- [ ] Redeploy fuer Live-Domain

## P2 - Future/Backlog
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Handy-App Ueberlegungen
- [ ] Standalone Homepage
- [ ] Windows Desktop App (Electron)
- [ ] IONOS MariaDB Integration (pausiert - Host-Limitierungen)
