# Graupner Suite – PRD (Product Requirements Document)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business (Tischlerei Graupner).
Features: customer management, unified article/service database, Anfragen inbox, and a highly customizable WYSIWYG 3-column document editor, Mahnwesen, Customer Self-Service Portal, Dispatch/Resource Planning, and integrated E-Mail module (IMAP + SMTP).

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
- IMAP Posteingang (Email Inbox) with auto-classification
- E-Mail Versandprotokoll with Delete, Resend, Address-Check
- Anfragen status management (Ungelesen → Gelesen → Zu bearbeiten → Erledigt)

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
- [x] Document Preview with A4 page breaks

### E-Mail Module
- [x] IMAP Posteingang (Email Inbox) with manual/auto assignment
- [x] Auto-Classification (Anfragen/Kunden DB check, VCF parsing, keyword detection)
- [x] Delete buttons ("Hier löschen" vs "Komplett löschen")
- [x] Dashboard alert for Unread/Unprocessed Emails
- [x] Merged Posteingang + Versandprotokoll into single "E-Mail" nav view
- [x] **Versandprotokoll: Rückstandslos löschen** (Apr 7, 2026)
- [x] **Versandprotokoll: Neu bearbeiten & senden** (Apr 7, 2026)
- [x] **Versandprotokoll: Adresse prüfen** (Kunden/Anfragen check) (Apr 7, 2026)

### Anfragen
- [x] Dynamic categories (Add/Edit/Delete, Drag & Drop sortable)
- [x] Status toggles (Ungelesen, Zu bearbeiten, Erledigt) with filter buttons
- [x] **"Gelesen" status added** (blue dot, 4-step cycle) (Apr 7, 2026)
- [x] Search includes Reparaturgruppen
- [x] VCF import
- [x] Quick notes
- [x] Email sending from Anfragen

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
- [x] Einsatzplanung (Dispatch planning)
- [x] Kundenportale (Customer self-service)
- [x] Website-Integration
- [x] ArticlesPage: full description visible (no truncation)

---

## Prioritized Backlog

### P1 – High Priority
- [ ] Landing Page IONOS FTP Upload (retry)
- [ ] Bank Integration: N26 CSV-Import / Open Banking

### P2 – Medium Priority
- [ ] Windows Desktop App (Electron wrapper)

### P3 – Low Priority
- [ ] SettingsPage refactoring (extract tabs into components/settings/)
- [ ] WysiwygDocumentEditor refactoring (>2100 lines, extract sub-components)
- [ ] Auftrags-Status-Workflow (extended order statuses)

---

## Architecture
```
/app/
├── backend/          (FastAPI + Motor/MongoDB)
│   ├── routes/
│   │   ├── articles.py
│   │   ├── email.py           ← DELETE/check-address/resend endpoints
│   │   ├── imap.py            ← IMAP Posteingang
│   │   ├── kalkulation.py
│   │   ├── leistungsbloecke.py
│   │   ├── quotes.py, orders.py, invoices.py
│   │   ├── settings.py
│   │   └── text_templates.py
│   └── models.py
├── frontend/         (React + Tailwind + Shadcn)
│   └── src/
│       ├── components/
│       │   ├── DocumentPreview.jsx
│       │   ├── WysiwygDocumentEditor.jsx
│       │   └── wysiwyg/
│       └── pages/
│           ├── EmailPage.jsx        ← Tabs wrapper
│           ├── EmailInboxPage.jsx   ← IMAP Posteingang
│           ├── EmailLogPage.jsx     ← Versandprotokoll + actions
│           ├── AnfragenPage.jsx     ← Status cycle with gelesen
│           └── ...
└── memory/
    ├── PRD.md
    └── test_credentials.md
```

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- SMTP Email Sending (User Credentials)
- IMAP Email Fetching (User Credentials)
