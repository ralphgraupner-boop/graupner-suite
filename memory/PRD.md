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
- [x] **WysiwygDocumentEditor Refactoring** (2.297 → 527 Zeilen, 10 Sub-Komponenten)
- [x] **Textbaustein Click-Outside Fix** (Dropdown schließt bei Klick außerhalb)
- [x] **Artikelkalkulation** (EK, Zeitanteile mit Lohnstufen, Materialzuschlag, Gewinnaufschlag)
- [x] **Kalkulationseinstellungen** (Stundensätze Meister/Geselle/Azubi/Helfer + Zuschläge global konfigurierbar)

## Code Architecture
```
/app/frontend/src/components/
├── WysiwygDocumentEditor.jsx    (540 lines - state & orchestration)
├── wysiwyg/
│   ├── EditorToolbar.jsx
│   ├── EditorSidebar.jsx        (+ KalkulationPanel integration)
│   ├── DocumentHeader.jsx
│   ├── PositionsTable.jsx
│   ├── TotalsSection.jsx
│   ├── RightSidebar.jsx
│   ├── EmailDialog.jsx
│   ├── SettingsSlideOver.jsx
│   ├── StammdatenPanel.jsx
│   ├── BloeckePanel.jsx
│   └── KalkulationPanel.jsx     (NEW: Artikelkalkulation)
├── PortalButtons.jsx
├── TextTemplateSelect.jsx       (+ Click-outside fix)
└── common/
```

## Key DB Schema
- `settings.kalk_meister/geselle/azubi/helfer`: Stundenlöhne (float)
- `settings.kalk_materialzuschlag/gewinnaufschlag`: Zuschläge in % (float)

## Backlog
- P1: N26 Bank Integration (CSV-Import / Open Banking)
- P2: Windows Desktop App (Electron wrapper)
- P3: SettingsPage Refactoring (>1.100 Zeilen → Sub-Komponenten)

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email (secure.emailsrvr.com:465)
- IMAP Email Reception (configurable)
- Push API (Browser native, VAPID keys)
