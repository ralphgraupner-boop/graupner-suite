# PRD - Graupner Suite (Handwerker-Software)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business. Features customer management, unified article/service database, Anfragen inbox, highly customizable WYSIWYG 3-column document editor, Mahnwesen (Dunning), Customer Self-Service Portal, and Dispatch/Resource Planning (Einsatzplanung).

## Core Users
- Tischlerei Graupner (carpentry business) admin/owner
- Workshop employees
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
│   │   ├── einsaetze.py
│   │   └── ...
│   ├── utils/
│   │   ├── storage.py
│   │   └── pdf_generator.py
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SettingsPage.jsx (with Einsatzplanung tab)
│   │   │   ├── EinsaetzePage.jsx
│   │   │   ├── AnfragenPage.jsx (with Reparaturgruppen)
│   │   │   ├── PortalsPage.jsx
│   │   │   └── CustomerPortalPage.jsx
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
- [x] Angebots-Nr formatting (large blue text)
- [x] Betreff text styled bold and blue
- [x] Removed Anmerkungen field, kept Schlusstext
- [x] Title blocks saveable to/selectable from templates
- [x] Leistungsblöcke (Service Blocks)
- [x] Prompt for Stammdaten changes when editing articles
- [x] First line of position descriptions rendered bold
- [x] Slide-over Settings panel with CRUD tabs
- [x] E-Mail Dialog with templates and placeholder replacement
- [x] PDF fully reworked: Briefkopf, DIN 5008, Betreff, Vortext, Schlusstext, Fußzeile
- [x] Mahnwesen (Dunning) with severity levels, fees, history
- [x] Vortext/Schlusstext templates available across all document types
- [x] Beschreibung search field in document tables
- [x] Self-Service Customer Portal (secure upload, messaging, auto-email)
- [x] Push Notifications + Email alerts for portal activity
- [x] Einsatzplanung Module Phase 1: Config, CRUD, Workflow Steps, Filters
- [x] Einsatzplanung config in Settings page (Anfrage-Schritte, Reparaturgruppen, Monteure, Materialien)
- [x] Reparaturgruppen integrated into Anfragen page (edit modal, detail view, list badges)

## Upcoming Tasks (P1)
- Einsatzplanung Phase 2: Google Kalender direkte Integration
- Einsatzplanung Phase 2: E-Mail-Vorlagen für Termintexte
- Einsatzplanung Phase 2: Kundenportal-Anbindung

## Future Tasks (P2-P5)
- P2: E-Mail-Empfang via IMAP (service24@tischlerei-graupner.de → Anfragen)
- P3: N26 Bank Integration (CSV-Import / Open Banking)
- P4: Windows Desktop App (Electron wrapper)
- P5: WysiwygDocumentEditor Refactoring (split into sub-components)

## Key DB Collections
- `articles`: { name, description, unit, price_net, typ: "Artikel"|"Leistung"|"Fremdleistung" }
- `leistungsbloecke`: { name, positions: [] }
- `text_templates`: { text_type, doc_type, title, content }
- `documents`: { type, customer_id, positions, status, ... }
- `customers`: { name, address, ... }
- `anfragen`: { name, email, categories, reparaturgruppe, ... }
- `portals`: { customer_id, token, password, files, notes }
- `einsaetze`: { customer_id, monteur_1, monteur_2, reparaturgruppe, material, status }
- `einsatz_config`: { monteure, reparaturgruppen, materialien, anfrage_schritte }

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email (secure.emailsrvr.com:465)
- Push API (Browser native, VAPID keys configured)
