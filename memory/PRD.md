# Graupner Suite - PRD

## Original Problem Statement
Handwerker-Verwaltungssoftware ("Graupner Suite") - modularer Aufbau mit eigenstaendigen Bausteinen.

## Architecture
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB
- **Storage**: Emergent Object Storage
- **Auth**: JWT-based (admin/Graupner!Suite2026)
- **Prinzip**: Modulare Architektur - jedes Modul ist eigenstaendig

## Module

### 1. Kontakt-Modul `/module/kontakt`
### 2. Kunden-Modul `/module/kunden`
### 3. Artikel & Leistungen `/module/artikel`
### 4. Dokumente `/module/dokumente`
### 5. Textvorlagen `/module/textvorlagen`
### 6. Kundenportal `/portals` + `/portal/:token`
### 7. Kontaktformular `/api/kontakt` + IONOS standalone
### 8. Buchhaltung `/buchhaltung` + Rechnungen `/invoices`
### 9. Einsaetze-Modul `/einsaetze` (NEU 18.04.2026)
- Auftragsbearbeitung wie das "gruene Formular"
- Kundendaten, Objektadresse, Beschreibung + Bemerkungen
- Reparaturgruppen + Material Dropdown (konfigurierbar)
- Monteur-Zuweisung (1. + 2. Monteur aus Mitarbeiter-Modul)
- Summe Netto/Brutto, Status, Prioritaet, Termine
- Kategorisierte Bild-Uploads (Kundenanfrage, Besichtigung, Abnahme etc.)
- E-Mail-Versand + ICS-Kalender-Download
- Einsatz aus Kontakt oder Kunde erstellbar
- 100% getestet (21/21 Backend + Frontend)

### 10. Mitarbeiter-Modul `/mitarbeiter` (NEU 18.04.2026)
- Frontend fuer bestehendes Backend (654 Zeilen)
- CRUD + Suche + Status aktiv/inaktiv
- Verknuepft mit Einsaetze (Monteur-Zuweisung)
- 100% getestet

## Completed 19.04.2026

### Artikel Multi-Format Import/Export
- [x] CSV, Excel, JSON, XML Export-Endpoints
- [x] Professionelles Dropdown-UI (shadcn)
- [x] Auto-Nummerierung (ArtNr, Leist, Fremd) + Duplikat-Pruefung
- [x] Import-Vorlage im Dropdown

### Mitarbeiter-Modul Pro-UI
- [x] 9 Tabs: Stammdaten · Beschäftigung · Steuer & SV · Bank & Lohn · Urlaub · Krankmeldungen · Verträge & Dokumente · Fortbildungen · Notfall & Notizen
- [x] Krankenkassen-Dropdown (50+ GKV/PKV in Gruppen)
- [x] Steuerklassen, Konfession, Personengruppenschlüssel
- [x] Arbeitsvertrags-Upload mit Kategorisierung (arbeitsvertrag, zeugnis, abmahnung, etc.)
- [x] Lohnhistorie (Gehaltsänderungen)
- [x] Urlaub mit Rest-Berechnung, Krankmeldungen mit AU-Flag
- [x] Geburtstags-Hinweis auf Liste (<30 Tage)
- [x] 9/9 Frontend-Tests grün

### Kundenportal Paket 2+3
- [x] Konfigurierbare Begrüßung + Hinweise via /api/portal-settings
- [x] Auto-Bildkomprimierung (max 1920px, JPEG 80%)
- [x] Limits: max 5 Bilder/Upload, max 30 pro Portal
- [x] Rate-Limit: >10 Uploads/60s → Auto-Sperre + Admin-Mail
- [x] Bidirektionale Dialog-Historie (chronologisch, chat-style)
- [x] Absenden-Button mit Vorschau-Dialog für Kunde
- [x] Speichern & Beenden-Button
- [x] Admin: "Vorschau & Senden" Modal vor An-Kunden-Mitteilungen
- [x] NEU-Badge in Portal-Liste (customer_has_new_content)
- [x] Mark-Read beim Öffnen der Portal-Detail
- [x] "Portal öffnen/anlegen"-Button direkt im Kunden-Modul
- [x] 18/18 Backend-Tests + alle Frontend-Flows grün

## Completed 18.04.2026
- [x] Kundenportal-Modul (26/26 Tests)
- [x] Kontaktformular-Modul (18/18 Tests) + IONOS Upload
- [x] Buchhaltung & Mahnwesen (30/30 Tests)
- [x] Einsaetze + Mitarbeiter Module (21/21 Tests)
- [x] Portal-Textbausteine (doc_type: kundenportal)
- [x] Links per Mail + in Diverses gespeichert
- [x] Redeploy auf Live-Domain (code-import-flow-1.emergent.host)

## Noch offen / Naechste Schritte
- [ ] Termintext-Vorlagen + Google Calendar Integration
- [ ] Mailtexte im Einsatz (Textvorlagen doc_type: einsatz)
- [ ] Arbeitsblatt-/Formular-Auswahl im Einsatz
- [ ] Bild-Upload Kategorien erweitern
- [ ] "Einsatz erstellen" Button im Kontakt- und Kunden-Modul

## P1 - In Arbeit / Gemerkt

### Stundenplan-Kontrolle (wichtig, auf morgen verschoben)
- Monatlicher Stundenplan-Ausdruck pro Mitarbeiter (Arbeitsbeginn/-ende)
- Beispiel-PDF als Referenz von User erwartet
- Ziel: Zeiterfassungs-Kontrolle parallel zu Lexware-Abrechnung

## Completed 19.04.2026 (Nachmittag) - Dokument-Editor Feedback-Fixes

### KRITISCHE REPARATUR
- [x] **SettingsPage.jsx Syntax-Fehler behoben**: Unpaariger `<Card>`-Tag in FirmendatenTab hatte die komplette Frontend-Kompilierung blockiert → deshalb funktionierten PDF-Button, Text-Korrektur etc. bei User NICHT. Nach Reparatur lädt App wieder.

### Feedback-Fixes (10-Punkte-Liste vom User)
- [x] **FIX 1** - Textvorlagen inline bearbeitbar: Bearbeiten + Löschen Buttons in TextTemplateSelect.jsx (data-testid: btn-edit-template / btn-delete-template / btn-save-edit-template)
- [x] **FIX 2** - Große Dokument-Headline über Betreff ("Angebot A-2026-0001" text-2xl lg:text-3xl in #003399) für quote/order/invoice
- [x] **FIX 3** - Plausibilitätsprüfung: validatePositions warnt bei Position mit Beschreibung aber 0€ Preis oder Menge 0
- [x] **FIX 4** - PDF-Button öffnet in neuem Tab (window.open) mit Fallback-Download bei Popup-Blocker
- [x] **FIX 5** - Mail-Dialog mit 2 Optionen ("Mit Vortext & Schlusstext" / "Ohne Text") + Abbrechen (data-testid: mail-client-dialog)
- [x] **FIX 6** - Briefkopf-Slogan Schriftgröße: slogan_font_size in Settings-Model + SettingsPage (Dokument-Vorlagen Tab) + pdf_generator.py nutzt Wert für "seit 1960" & "Mitglied der Handwerkskammer"
- [x] **Neue Leistung/Artikel Sync**: handleSavePositionAsArticle setzt setSidebarSearch("") + wechselt sidebarTab nach dem Speichern → neue Position sofort sichtbar

### Verifikation
- Backend: 8/8 pytest green (slogan_font_size GET/PUT/persist, PDF generation mit custom size)
- Frontend: Mail-Dialog visuell bestätigt, PDF-Button + große Headline sichtbar, Settings-Feld funktioniert

## P2 - Backlog
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Handy-App (Monteur-Zugang)
- [ ] Standalone Homepage
- [ ] Windows Desktop App

## Completed 19.02.2026 - Kundenportal Text-Vorlagen mit {anrede_brief}
- [x] Backend `module_textvorlagen.py`: `VALID_DOC_TYPES` erweitert um `kundenportal`, `einsatz`, `termin`; `VALID_TEXT_TYPES` um `portal_nachricht`
- [x] Backend neuer Endpoint `POST /api/modules/textvorlagen/seed-kundenportal` - legt 3 Standard-Vorlagen idempotent an (Begruessung+Bilder, Weitere Bilder, Rueckfrage)
- [x] Frontend `PortalsPage.jsx`: `applyVorlage` ersetzt jetzt `{anrede_brief}`, `{kunde_name}`, `{kunde_email}`, `{kunde_telefon}`, `{firma}`, `{datum}` + HTML-Tag-Strip
- [x] Frontend `TextvorlagenModulPage.jsx`: Button "Portal-Vorlagen importieren" (Sparkles-Icon), `portal_nachricht` in Labels+Colors
- [x] Verifikation: Seed 2x getestet (3 inserted → 3 skipped), Lint clean
- [x] Live-Deploy: User klickt nach Redeploy einmal auf "Portal-Vorlagen importieren"

## Completed 20.02.2026 - HEIC/iPhone-Upload Fix (Kundenportal)
- [x] Backend: `pillow-heif==1.3.0` installiert + `register_heif_opener()` in `portal.py`, requirements.txt aktualisiert
- [x] Backend `ALLOWED_IMAGE_TYPES` um `image/heic`, `image/heif`, `image/heic-sequence`, `image/heif-sequence`, `application/octet-stream` erweitert
- [x] Backend: Fallback-Validierung per Datei-Endung (`.heic`, `.heif`, `.jpg`, `.png`, `.webp`) falls Handy-Browser generischen content-type sendet
- [x] Frontend `CustomerPortalPage.jsx`: `accept="image/*,image/heic,image/heif,.heic,.heif"` statt restriktiv JPG/PNG/WebP
- [x] `compress_image` konvertiert HEIC automatisch zu JPEG (testweise 421 Byte HEIC → 361 Byte JPEG erfolgreich)
- [x] Verifikation E2E: HEIC-Upload + JPEG-Regression beide OK via curl, Lint clean
