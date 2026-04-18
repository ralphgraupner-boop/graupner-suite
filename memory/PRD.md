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
- **Status**: Fertig (100% getestet)

### 7. Kontaktformular (Standalone) (18.04.2026)
- **Inline-Seite**: `/api/kontakt` (ohne Auth, oeffentlich)
- **Standalone-HTML**: `/app/landing_page/kontaktformular.html`
- **API**: `/api/kontakt/submit`, `/api/webhook/contact`, `/api/webhook/contact-beacon`
- **Speichert in**: `module_kontakt`
- **Status**: Fertig (100% getestet)

### 8. Buchhaltung & Mahnwesen (18.04.2026)
- **Buchhaltung**: `/buchhaltung`
- **Rechnungen**: `/invoices`
- **DB**: `buchungen`, `invoices`, `buchhaltung_config`, `counters`
- **API**: `/api/buchhaltung/*`, `/api/invoices/*`
- **Features**: Buchungen (Einnahmen/Ausgaben), Belegnummern, Kategorien, MwSt, CSV/Excel Export, Kassenbuch, Monatsabschluss, USt/MwSt, Rechnungen mit Positionen, Mahnwesen (3 Stufen), Faelligkeitspruefung
- **Status**: Fertig (100% getestet - 30/30 Backend + Frontend)

## Modul-Verknuepfungen
1. Kontakt <-> Kunden: Bidirektionaler Transfer
2. Kunden-Modul -> Dokumente: Kunden im Editor Dropdown
3. Artikel -> Dokumente: Positionen im Editor
4. Textvorlagen -> Dokumente: Textbausteine im Editor
5. Kunden-Modul -> Kundenportal: Portal direkt aus Kunde erstellen
6. Kontakt-Modul -> Kundenportal: Portal aus Kontakt erstellen
7. Kontaktformular -> Kontakt-Modul: Externe Anfragen im Kontakt-Modul
8. Kunden-Modul -> Rechnungen: Kunden-Daten in Rechnungserstellung

## Lohnanteil
- Jede Position hat ein "Lohnanteil" Feld
- Automatische Summe, Steuerung, MwSt-Satz konfigurierbar
- In invoices.py ueber show_lohnanteil und lohnanteil_custom

## Legacy-System (aus Navigation entfernt)
- Alte Seiten in _legacy_backup/
- Alle Webhooks speichern in module_kontakt

## Completed (18.04.2026)
- [x] Kundenportal-Modul installiert
- [x] Kontaktformular-Modul installiert (module_kontakt)
- [x] Buchhaltung & Mahnwesen Modul installiert
- [ ] Redeploy fuer Live-Domain

## P2 - Future/Backlog
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Handy-App
- [ ] Standalone Homepage
- [ ] Windows Desktop App (Electron)
- [ ] Standalone-Kontaktformular auf IONOS hochladen
