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
│   ├── server.py (includes IMAP auto-polling background task)
│   ├── models.py
│   ├── routes/
│   │   ├── articles.py, leistungsbloecke.py, settings.py
│   │   ├── text_templates.py, portal.py
│   │   ├── einsaetze.py (email send, .ics, multi reparaturgruppen)
│   │   ├── imap.py (IMAP fetch + test + internal polling fn)
│   │   └── ...
│   ├── utils/
│   │   ├── storage.py, pdf_generator.py
├── frontend/
│   ├── src/pages/
│   │   ├── SettingsPage.jsx (Einsatzplanung tab, IMAP settings)
│   │   ├── EinsaetzePage.jsx (2-col dialog, multi-select gruppen, email dialog)
│   │   ├── AnfragenPage.jsx (multi-select reparaturgruppen)
│   │   ├── PortalsPage.jsx, CustomerPortalPage.jsx (termin section)
```

## Completed Features (as of 2026-04-05)
- [x] Dashboard, Customer Management, Anfragen Inbox
- [x] Documents: Angebote, Aufträge, Rechnungen with WYSIWYG Editor
- [x] DIN 5008 PDF, Letterhead, Leistungsblöcke, Title Groups
- [x] Mahnwesen (Dunning), E-Mail Dialog
- [x] Self-Service Customer Portal with Push Notifications
- [x] Einsatzplanung Phase 1 + Phase 2:
  - Config (Monteure, Reparaturgruppen, Materialien, Anfrage-Schritte, Termin-Vorlagen)
  - Multi-Select Reparaturgruppen (max 3) in Einsatz + Anfragen
  - 2-Spalten Einsatz-Dialog mit Termintext + Vorlagen
  - E-Mail-Versand mit .ics Anhang + Vorlagen
  - Google Kalender Link + .ics Download
  - Kundenportal zeigt Termin-Info
  - Settings-Tab für Einsatzplanung
- [x] IMAP E-Mail-Empfang (manuell + Auto-Polling alle 5 Min)
- [x] Reparaturgruppen in Einstellungen konfigurierbar

## Key Data Model Changes
- `reparaturgruppe` (string) → `reparaturgruppen` (List[str]) in Anfrage + Einsatz
- Frontend handles backward compat: `(e.reparaturgruppen || (e.reparaturgruppe ? [e.reparaturgruppe] : []))`

## Backlog (P3-P5)
- P3: N26 Bank Integration
- P4: Windows Desktop App
- P5: WysiwygDocumentEditor Refactoring

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email (secure.emailsrvr.com:465)
- IMAP Email Reception (configurable)
- Push API (Browser native, VAPID keys configured)
