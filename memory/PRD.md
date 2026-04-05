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
- [x] Einsatzplanung Phase 1 + Phase 2 (Multi-Select Reparaturgruppen, 2-Spalten-Dialog, E-Mail-Vorlagen, .ics, Google Kalender)
- [x] IMAP E-Mail-Empfang (manuell + Auto-Polling alle 5 Min)
- [x] Reparaturgruppen in Einstellungen + Anfragen (Multi-Select)
- [x] **E-Mail-Versand aus Anfragen** mit Vorlagen-Datenbank (CRUD in Einstellungen, Suchfeld im Dialog, Platzhalter-Ersetzung, Kunden-E-Mail vorausgefüllt)

## Key API Endpoints
- `GET/POST/PUT/DELETE /api/email/vorlagen` - E-Mail-Vorlagen CRUD
- `POST /api/email/anfrage/{id}` - E-Mail von Anfrage senden
- `POST /api/einsaetze/{id}/email` - Termin-E-Mail senden
- `GET /api/einsaetze/{id}/ics` - .ics Kalender-Download
- `GET/POST /api/imap/fetch` - IMAP E-Mails abrufen
- `POST /api/imap/test` - IMAP Verbindungstest

## Key DB Collections
- `email_vorlagen`: { id, name, betreff, text, created_at }
- `einsatz_config`: { monteure, reparaturgruppen, materialien, anfrage_schritte, termin_vorlagen }
- `anfragen`: { ..., reparaturgruppen: [] }
- `einsaetze`: { ..., reparaturgruppen: [] }

## Backlog
- P3: N26 Bank Integration
- P4: Windows Desktop App
- P5: WysiwygDocumentEditor Refactoring

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email (secure.emailsrvr.com:465)
- IMAP Email Reception (configurable)
- Push API (Browser native, VAPID keys)
