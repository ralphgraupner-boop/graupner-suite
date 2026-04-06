# Graupner Suite – PRD (Product Requirements Document)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business (Tischlerei Graupner).
Features: customer management, unified article/service database, Anfragen inbox, and a highly customizable WYSIWYG 3-column document editor.

## User Personas
- **Primary**: Ralph Graupner (Business owner, carpenter) — creates quotes, invoices, manages articles/services, needs professional document output.

## Core Requirements
- Customer CRUD
- Articles/Services/Fremdleistung management
- WYSIWYG document editor for Angebote, Aufträge, Rechnungen
- DIN 5008 compliant letterhead and address formatting
- PDF generation and email sending
- Profi-Kalkulation per position
- Inline sidebar editing, drag-and-drop positioning
- Leistungsblöcke (service block templates)
- Titel-Gruppen with discount calculations
- Mahnwesen (Dunning system)
- Settings panel with SMTP, company info, master data CRUD

---

## What's Been Implemented

### Document Editor (WYSIWYG)
- [x] 3-column layout: Sidebar | Document | Kalkulation
- [x] Drag & Drop positions at exact drop index
- [x] Inline Edit/Delete in sidebar
- [x] Profi-Kalkulation via click (not hover) with master data save/overwrite
- [x] Title groups (Gewerk-/Titelzusammenstellung) with discount calculations
- [x] Leistungsblöcke: select multiple positions, save as block, re-insert
- [x] Titel templates (save & select)
- [x] "Änderung in Stammdaten übernehmen?" prompt on edit
- [x] First line of descriptions rendered bold
- [x] DIN 5008 letterhead with "Tischlerei Graupner seit 1960"
- [x] Angebots-Nr large blue, Betreff bold blue
- [x] Removed Anmerkungen, kept Schlusstext
- [x] Document Preview ("Vorschau") button in toolbar
- [x] **Document Preview with A4 page breaks** (Apr 6, 2026)
  - Gray PDF-viewer background
  - Multi-page A4 layout with shadows
  - Page numbers ("Seite X von Y")
  - Continuation headers on subsequent pages
  - Footer on last page
  - Bold first line via CSS ::first-line

### Settings Panel (Slide-over)
- [x] Company info tab
- [x] Email/SMTP configuration (port 465 fix)
- [x] Leistungen/Artikel CRUD with search/filter
- [x] Blöcke management

### Other Features
- [x] Customer management
- [x] Quotes/Orders/Invoices CRUD
- [x] PDF generation & download
- [x] Email sending with attachment
- [x] Mahnwesen (Dunning system)
- [x] Anfragen inbox
- [x] ArticlesPage: full description visible (no truncation)

---

## Prioritized Backlog

### P1 – High Priority
- [ ] E-Mail-Empfang via IMAP (service24@tischlerei-graupner.de → Anfragen)
- [ ] Landing Page IONOS FTP Upload (retry)
- [ ] Bank Integration: N26 CSV-Import / Open Banking

### P2 – Medium Priority
- [ ] Windows Desktop App (Electron wrapper)

### P3 – Low Priority
- [ ] SettingsPage refactoring (extract tabs into components/settings/)
- [ ] Auftrags-Status-Workflow (extended order statuses)
- [ ] Druckansicht für Dokumente (print-friendly views)

---

## Architecture
```
/app/
├── backend/          (FastAPI + Motor/MongoDB)
│   ├── routes/
│   │   ├── articles.py
│   │   ├── kalkulation.py
│   │   ├── leistungsbloecke.py
│   │   ├── quotes.py, orders.py, invoices.py
│   │   ├── settings.py
│   │   └── text_templates.py
│   └── models.py
├── frontend/         (React + Tailwind + Shadcn)
│   └── src/
│       ├── components/
│       │   ├── DocumentPreview.jsx      ← A4 paginated preview
│       │   ├── WysiwygDocumentEditor.jsx
│       │   └── wysiwyg/
│       │       ├── EditorSidebar.jsx
│       │       ├── PositionsTable.jsx
│       │       ├── KalkulationPanel.jsx
│       │       ├── EditorToolbar.jsx
│       │       ├── TotalsSection.jsx
│       │       └── ...
│       └── pages/
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- SMTP Email Sending (User Credentials)
