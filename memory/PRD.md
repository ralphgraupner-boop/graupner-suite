# PRD - Graupner Suite (Handwerker-Software)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business. Features customer management, unified article/service database, Anfragen inbox, and a highly customizable WYSIWYG 3-column document editor.

## Core Users
- Tischlerei Graupner (carpentry business) admin/owner
- Workshop employees

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
│   │   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── SettingsPage.jsx
│   │   ├── components/
│   │   │   └── WysiwygDocumentEditor.jsx (>2130 lines)
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## Completed Features (as of 2026-04-03)
- [x] Dashboard with KPIs
- [x] Customer Management (CRUD)
- [x] Anfragen (Inquiries) Inbox
- [x] Documents: Angebote, Aufträge, Rechnungen
- [x] WYSIWYG Document Editor with drag-and-drop
- [x] Title Groups & Discount Calculations (Gewerk-/Titelzusammenstellung)
- [x] DIN 5008 compliant letterhead & address window
- [x] Header/Letterhead branding (Tischlerei Graupner, seit 1960)
- [x] Angebots-Nr formatting (large blue text)
- [x] Betreff text styled bold and blue
- [x] Removed Anmerkungen field, kept Schlusstext
- [x] Title blocks saveable to/selectable from templates
- [x] Leistungsblöcke (Service Blocks) - save/insert groups of positions
- [x] Prompt for Stammdaten changes when editing articles in documents
- [x] First line of position descriptions rendered bold
- [x] Slide-over Settings panel with CRUD tabs for Leistungen/Artikel/Blöcke
- [x] Fixed Articles tab showing Services bug
- [x] Fixed SMTP Email settings bug
- [x] Fixed sidebar Leistungen showing 0 items bug (2026-04-03)
- [x] Save button now keeps editor open (Zwischenspeichern), separate "Beenden" button to exit (2026-04-03)
- [x] Toolbar: E-Mail, Drucken, PDF, Speichern, Beenden (inkl. Speichern) buttons added (2026-04-03)
- [x] E-Mail Dialog: Vorlagen-Dropdown für Nachrichtentext mit Platzhalter-Ersetzung und "Als Vorlage speichern" (2026-04-03)
- [x] PDF: Titel-Zeilen fett gedruckt, erste Beschreibungszeile fett, mehrzeilige Beschreibungen korrekt (2026-04-03)
- [x] PDF komplett überarbeitet: Briefkopf, rechte Spalte, DIN 5008, Betreff, Vortext, Schlusstext, Fußzeile (2026-04-03)
- [x] DocumentPreview (Vorschau beim Öffnen) angepasst: gleicher Briefkopf wie Editor + PDF (2026-04-03)
- [x] Mahnwesen komplett überarbeitet: Briefkopf, Mahngebühren (5€/10€), Mahnungshistorie, Bankverbindung im Text (2026-04-03)
- [x] Mahnungs-Editor: Dialog mit Dringlichkeitswahl (Stufe 1-3), editierbarem Mahntext, Kostenaufstellung, Custom-Text im PDF (2026-04-03)
- [x] Mahnwesen-Flow: Klick auf Karte → Rechnungsvorschau → "Mahnung erstellen" Button → Editor mit Fertigtext-Vorlagen (2026-04-03)
- [x] Fußtext (Firma, Bankverbindung, Steuernr.) in Mahnungs-Split-View eingefügt – links (Rechnungsvorschau) und rechts (Editor) (2026-04-03)
- [x] Bugfix: Vortext/Schlusstext/Betreff-Vorlagen jetzt dokumenttyp-übergreifend verfügbar (Angebot, Auftrag, Rechnung) (2026-04-03)
- [x] Beschreibungsfeld (Betreff) + Suchfilter in Angebote-, Aufträge- und Rechnungslisten hinzugefügt (2026-04-03)
- [x] Performance: React.lazy für SettingsPanel, useMemo für Filter-Berechnungen (2026-04-03)
- [x] Article management page
- [x] E-Mail protocol
- [x] Website Integration page
- [x] Settings page

## Bug Fixes (2026-04-03)
- Fixed: Sidebar "Leistungen" tab showing 0 items despite API returning 11 services
  - Root cause: `filteredServices` was filtering from `articles` state (only Artikel items) instead of `services` state
  - Fix: Changed filter source from `articles` to `services` in WysiwygDocumentEditor.jsx line 408

## Upcoming Tasks (P1)
- E-Mail-Empfang via IMAP (fetch emails to Anfragen) - reminder for April 5/6
- Landing Page IONOS FTP Upload - reminder for April 5/6

## Future Tasks (P2-P4)
- P2: Bank Integration (N26 CSV-Import / Open Banking)
- P3: Windows Desktop App (Electron wrapper)
- P3: Auftrags-Status-Workflow
- P3: Druckansicht für Dokumente
- P4: WysiwygDocumentEditor Refactoring (split into sub-components)

## Key DB Collections
- `articles`: { name, description, unit, price_net, typ: "Artikel"|"Leistung"|"Fremdleistung" }
- `leistungsbloecke`: { name, positions: [] }
- `text_templates`: { text_type: "vortext"|"schlusstext"|"titel", ... }
- `documents`: { type, customer_id, positions, status, ... }
- `customers`: { name, address, ... }

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email (secure.emailsrvr.com:465)
