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

## P2 - Backlog
- [ ] DATEV-Export
- [ ] Lexoffice-Anbindung
- [ ] Handy-App (Monteur-Zugang)
- [ ] Standalone Homepage
- [ ] Windows Desktop App
