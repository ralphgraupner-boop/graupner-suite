# Graupner Suite – PRD (Product Requirements Document)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business (Tischlerei Graupner).
Features: customer management, unified article/service database, Anfragen inbox, WYSIWYG 3-column document editor, Mahnwesen, Customer Self-Service Portal, Dispatch/Resource Planning, integrated E-Mail module (IMAP + SMTP), and Buchhaltung (Accounting).

## User Personas
- **Primary**: Ralph Graupner (Business owner, carpenter, 50+ years experience) — creates quotes, invoices, manages articles/services, needs professional document output and absolute data control.

## Core Requirements
- Customer CRUD
- Articles/Services/Fremdleistung management
- WYSIWYG document editor for Angebote, Aufträge, Rechnungen
- DIN 5008 compliant letterhead and address formatting
- PDF generation and email sending
- Profi-Kalkulation per position
- Leistungsblöcke, Titel-Gruppen with discount calculations
- Mahnwesen (Dunning system)
- Settings panel with SMTP, company info, master data CRUD
- IMAP Posteingang (Email Inbox) with auto-classification
- E-Mail Versandprotokoll with Delete, Resend, Address-Check
- Anfragen status management (Ungelesen → Gelesen → Zu bearbeiten → Erledigt)
- **Buchhaltung**: Einnahmen/Ausgaben, Offene Posten, Zahlungseingang, USt/MwSt, Kategorien
- **Data Control**: Everything rückstandslos löschbar, bearbeitbar, keine versteckten Logs

---

## What's Been Implemented

### Buchhaltung (Accounting Module) - NEW Apr 7, 2026
- [x] Übersicht-Dashboard: KPI-Karten (Einnahmen/Ausgaben/Gewinn), Monatliches Balkendiagramm, Kategorien-Aufschlüsselung
- [x] Buchungen CRUD: Einnahmen & Ausgaben erfassen, bearbeiten, rückstandslos löschen
- [x] Auto-Berechnung: Netto ↔ Brutto mit MwSt-Satz
- [x] Offene Posten: Direkt aus Rechnungen, "Bezahlt"-Button → markiert Rechnung + erstellt Buchung
- [x] Zahlung rückgängig: Rechnung zurück auf Offen, Buchung gelöscht
- [x] USt/MwSt-Übersicht: Umsatzsteuer, Vorsteuer, Zahllast
- [x] Frei konfigurierbare Kategorien (Einnahme + Ausgabe)
- [x] Zeitraum-Filter: Monat/Quartal/Jahr/Gesamt
- [x] Doppelklick-Löschung (Sicherheitsabfrage)

### E-Mail Module
- [x] IMAP Posteingang with auto-classification
- [x] Versandprotokoll: Rückstandslos löschen, Neu bearbeiten & senden, Adresse prüfen (Apr 7)

### Anfragen
- [x] 4-Stufen Status: Ungelesen → Gelesen → Zu bearbeiten → Erledigt (Apr 7)
- [x] Dynamic categories, VCF import, Quick notes

### Document Editor (WYSIWYG)
- [x] 3-column layout, Drag & Drop, Profi-Kalkulation
- [x] Title groups, Leistungsblöcke, DIN 5008 letterhead
- [x] Document Preview with A4 page breaks

### Other Features
- [x] Customer management, Quotes/Orders/Invoices CRUD
- [x] PDF generation, Email sending, Mahnwesen
- [x] Einsatzplanung, Kundenportale, Website-Integration

---

## Prioritized Backlog

### P1 – High Priority
- [ ] Landing Page IONOS FTP Upload (retry)
- [ ] Bank Integration: N26 CSV-Import / Open Banking

### P2 – Medium Priority
- [ ] Windows Desktop App (Electron wrapper)

### P3 – Low Priority
- [ ] SettingsPage refactoring
- [ ] WysiwygDocumentEditor refactoring (>2100 lines)
- [ ] Auftrags-Status-Workflow

### Future / On Request
- [ ] Lexoffice-Anbindung (Löhne)
- [ ] DATEV-Export

---

## Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── buchhaltung.py      ← NEW: Accounting CRUD + Statistiken
│   │   ├── email.py, imap.py
│   │   ├── invoices.py, quotes.py, orders.py
│   │   ├── settings.py, articles.py
│   │   └── ...
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── BuchhaltungPage.jsx  ← NEW: Full accounting UI
│       │   ├── EmailLogPage.jsx     ← Updated with actions
│       │   ├── AnfragenPage.jsx     ← Updated with Gelesen status
│       │   └── ...
│       └── components/
└── memory/
```

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- SMTP Email Sending (User Credentials)
- IMAP Email Fetching (User Credentials)
