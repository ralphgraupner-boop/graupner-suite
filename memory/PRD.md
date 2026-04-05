# PRD - Graupner Suite (Handwerker-Software)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI
- Backend: FastAPI, Motor (async MongoDB)
- Database: MongoDB
- LLM: OpenAI GPT-5.2 via Emergent LLM Key

## Completed Features (as of 2026-04-05)
- [x] Dashboard, Customer Management, Anfragen Inbox
- [x] Documents: Angebote, Aufträge, Rechnungen with WYSIWYG Editor
- [x] DIN 5008 PDF, Letterhead, Leistungsblöcke, Title Groups
- [x] Mahnwesen (Dunning), E-Mail Dialog
- [x] Self-Service Customer Portal with Push Notifications
- [x] Einsatzplanung Phase 1 + Phase 2
- [x] IMAP E-Mail-Empfang (manuell + Auto-Polling)
- [x] 1-Click Kundenportal-Erstellung + Auto-E-Mail-Einladungen
- [x] Shared PortalButtons.jsx für Anfragen/Einsätze/Kunden
- [x] Passwort-Datei in Einstellungen (Benutzer-Tab)
- [x] WysiwygDocumentEditor Refactoring (2.297 → 527 Zeilen, 10 Sub-Komponenten)
- [x] Textbaustein Click-Outside Fix
- [x] **Artikelkalkulation** (EK, Zeitanteile mit Lohnstufen, Materialzuschlag, Gewinnaufschlag)
- [x] **Kalkulationseinstellungen** (Stundensätze Meister/Geselle/Azubi/Helfer + Zuschläge global konfigurierbar)
- [x] **Kalkulationshistorie** (Vollständige Kalkulation pro Artikel gespeichert, aufklappbare Details, letzte Kalkulation vorausfüllbar, "Kalkulation laden" aus Historie)

## Code Architecture
```
/app/frontend/src/components/wysiwyg/
├── KalkulationPanel.jsx     (Historie + Vorausfüllung + Berechnung)
├── EditorSidebar.jsx        (+ Kalkulations-Button)
├── ...
/app/backend/routes/
├── kalkulation.py           (NEW: POST save, GET history, GET latest)
├── ...
```

## Key DB Collections
- `kalkulation_historie`: { id, article_id, article_name, ek, zeit_meister/geselle/azubi/helfer, rate_*, sonstige_kosten[], materialzuschlag, gewinnaufschlag, lohnkosten, zwischensumme, vk_preis, created_at }
- `settings`: kalk_meister, kalk_geselle, kalk_azubi, kalk_helfer, kalk_materialzuschlag, kalk_gewinnaufschlag

## Key API Endpoints
- `POST /api/kalkulation` - Kalkulation speichern
- `GET /api/kalkulation/{article_id}` - Historie (max 20, neuste zuerst)
- `GET /api/kalkulation/{article_id}/latest` - Letzte Kalkulation

## Backlog
- P1: N26 Bank Integration (CSV-Import / Open Banking)
- P2: Windows Desktop App (Electron wrapper)
- P3: SettingsPage Refactoring (>1.100 Zeilen → Sub-Komponenten)

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email (secure.emailsrvr.com:465)
- IMAP Email Reception (configurable)
- Push API (Browser native, VAPID keys)
