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

## Modul-Verknuepfungen (Fertig 15.04.2026)
1. Kontakt <-> Kunden: Bidirektionaler Transfer
2. Kunden-Modul -> Dokumente: Kunden im Editor Dropdown
3. Artikel -> Dokumente: Positionen im Editor
4. Textvorlagen -> Dokumente: Textbausteine im Editor (Overlay mit Neu-Erstellen)

## Lohnanteil (15.04.2026)
- Jede Position hat ein "Lohnanteil" Feld (netto pro Einheit)
- Automatische Summe (Menge x Lohnanteil)
- Freier Wert moeglich
- Steuerung: "Wird ausgewiesen" / "Nicht ausweisen"
- Platzhalter: {lohnanteil}, {lohnanteil_mwst}, {lohnanteil_brutto}, {mwst_satz}
- MwSt-Satz aus Einstellungen konfigurierbar
- Gilt fuer Angebot, Auftragsbestaetigung UND Rechnung (ueberall erfassbar und testbar)
- Im Endtext der Rechnung wird der Lohnanteil-Text eingefuegt

## Rich-Text-Editor
- react-quill-new fuer Textvorlagen und Dokument-Editor (Vortext/Schlusstext)
- PDF-Generator unterstuetzt HTML (fett, kursiv, unterstrichen, Farbe)
- Dokument-Vorschau rendert HTML

## Legacy-System (aus Navigation entfernt)
- Alte Seiten existieren noch als Dateien, sind aber nicht mehr erreichbar
- Navigation zeigt nur: Dashboard, Module, E-Mail, Einstellungen

## Alle APIs auf Module umgestellt
- Dokument-Editor: nur Modul-Daten (kein Legacy)
- E-Mail-Posteingang: Klassifizierung + Auto-Import ins Kontakt-Modul
- Dashboard: Zeigt Modul-Daten (Kontakt-Modul Anfragen + Kunden-Modul)

## P1 - Next Tasks
- [ ] Lohnanteil Feld groesser/sichtbarer (erledigt)
- [ ] Lohnanteil im PDF testen
- [ ] ERR_BLOCKED_BY_CLIENT Bug fixen
- [ ] Redeploy fuer Live-Domain

## P2 - Future/Backlog
- [ ] Standalone Homepage
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Windows Desktop App (Electron)
