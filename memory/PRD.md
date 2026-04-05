# PRD - Graupner Suite (Handwerker-Software)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business. Features customer management, unified article/service database, Anfragen inbox, highly customizable WYSIWYG 3-column document editor, Mahnwesen (Dunning), Customer Self-Service Portal, Dispatch/Resource Planning (Einsatzplanung) with email templates and calendar integration, and IMAP email reception.

## Core Users
- Tischlerei Graupner (carpentry business) admin/owner
- Workshop employees (Monteure)
- Customers (via Self-Service Portal)

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI
- Backend: FastAPI, Motor (async MongoDB)
- Database: MongoDB
- LLM: OpenAI GPT-5.2 via Emergent LLM Key

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── models.py
│   ├── routes/
│   │   ├── articles.py
│   │   ├── leistungsbloecke.py
│   │   ├── settings.py
│   │   ├── text_templates.py
│   │   ├── portal.py
│   │   ├── einsaetze.py (email send, .ics generation)
│   │   ├── imap.py (IMAP fetch, test)
│   │   └── ...
│   ├── utils/
│   │   ├── storage.py
│   │   └── pdf_generator.py
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SettingsPage.jsx (Einsatzplanung tab, IMAP settings)
│   │   │   ├── EinsaetzePage.jsx (email dialog, .ics, vorlagen)
│   │   │   ├── AnfragenPage.jsx (Reparaturgruppen)
│   │   │   ├── PortalsPage.jsx
│   │   │   └── CustomerPortalPage.jsx (termin section)
│   │   ├── components/
│   │   │   └── WysiwygDocumentEditor.jsx (>2200 lines)
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Completed Features (as of 2026-04-05)
- [x] Dashboard with KPIs
- [x] Customer Management (CRUD)
- [x] Anfragen (Inquiries) Inbox with Reparaturgruppen integration
- [x] Documents: Angebote, Aufträge, Rechnungen
- [x] WYSIWYG Document Editor with drag-and-drop
- [x] Title Groups & Discount Calculations (Gewerk-/Titelzusammenstellung)
- [x] DIN 5008 compliant letterhead & address window
- [x] Header/Letterhead branding (Tischlerei Graupner, seit 1960)
- [x] Leistungsblöcke (Service Blocks)
- [x] E-Mail Dialog with templates and placeholder replacement
- [x] PDF fully reworked: Briefkopf, DIN 5008, Betreff, Vortext, Schlusstext, Fußzeile
- [x] Mahnwesen (Dunning) with severity levels, fees, history
- [x] Self-Service Customer Portal (secure upload, messaging, auto-email)
- [x] Push Notifications + Email alerts for portal activity
- [x] Einsatzplanung Module Phase 1: Config, CRUD, Workflow Steps, Filters
- [x] Einsatzplanung config in Settings page
- [x] Reparaturgruppen integrated into Anfragen page
- [x] **E-Mail-Vorlagen für Termintexte** (configurable templates with placeholders, SMTP send with .ics)
- [x] **Google Kalender + .ics Download** for Einsätze
- [x] **Kundenportal-Anbindung** (shows termin info from linked Einsatz)
- [x] **IMAP E-Mail-Empfang** (fetch emails, auto-create Anfragen, connection test)

## Upcoming Tasks
- None currently queued

## Backlog (P3-P5)
- P3: N26 Bank Integration (CSV-Import / Open Banking)
- P4: Windows Desktop App (Electron wrapper)
- P5: WysiwygDocumentEditor Refactoring (split into sub-components)

## Key DB Collections
- `articles`: { name, description, unit, price_net, typ }
- `leistungsbloecke`: { name, positions: [] }
- `text_templates`: { text_type, doc_type, title, content }
- `documents`: { type, customer_id, positions, status, ... }
- `customers`: { name, address, ... }
- `anfragen`: { name, email, categories, reparaturgruppe, ... }
- `portals`: { customer_id, token, password, files, notes }
- `einsaetze`: { customer_id, monteur_1, monteur_2, reparaturgruppe, material, status, termin, termin_text }
- `einsatz_config`: { monteure, reparaturgruppen, materialien, anfrage_schritte, termin_vorlagen }

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email (secure.emailsrvr.com:465)
- IMAP Email Reception (configurable in Settings)
- Push API (Browser native, VAPID keys configured)
