# Graupner Suite – PRD (Product Requirements Document)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business (Tischlerei Graupner).
Features: customer management, unified article/service database, Anfragen inbox, WYSIWYG 3-column document editor, Mahnwesen, Customer Self-Service Portal, Dispatch/Resource Planning, integrated E-Mail module (IMAP + SMTP), and Buchhaltung (Accounting).

## User Personas
- **Primary**: Ralph Graupner (Business owner, carpenter, 50+ years experience) — absolute Datenkontrolle, keine Spuren, einfache Bedienung.

---

## What's Been Implemented

### Buchhaltung (Accounting Module) – Lexoffice-ähnlich
- [x] Übersicht-Dashboard: KPI-Karten (Einnahmen/Ausgaben/Gewinn), Monatliches Balkendiagramm, Kategorien-Aufschlüsselung
- [x] Buchungen CRUD: Einnahmen & Ausgaben erfassen, bearbeiten, rückstandslos löschen
- [x] **Fortlaufende Belegnummern** (B-YYYY-NNNN Format, auto-generiert) *(Apr 7, 2026)*
- [x] **Plausibilitätsprüfung**: Doppelbuchungs-Erkennung, Betrags-Validierung (0/negativ, >50k), fehlende Kategorie/Beschreibung, Zukunftsdatum *(Apr 7, 2026)*
- [x] **Kassenbuch**: Chronologische Auflistung mit laufendem Saldo *(Apr 7, 2026)*
- [x] **Monatsabschluss**: Jahresübersicht mit monatlicher Zusammenfassung (Einnahmen/Ausgaben/Gewinn/USt) *(Apr 7, 2026)*
- [x] **CSV-Export**: Für Steuerberater (Semikolon-getrennt, deutsche Zahlenformatierung) *(Apr 7, 2026)*
- [x] **Hilfe-Overlay** (Bedienungsanleitung): 10 Akkordeon-Abschnitte mit ausführlichen Erklärungen *(Apr 7, 2026)*
- [x] Offene Posten: Direkt aus Rechnungen, "Bezahlt"-Button → markiert Rechnung + erstellt Buchung
- [x] Zahlung rückgängig: Rechnung zurück auf Offen, Buchung gelöscht
- [x] USt/MwSt-Übersicht: Umsatzsteuer, Vorsteuer, Zahllast
- [x] Frei konfigurierbare Kategorien
- [x] Zeitraum-Filter: Monat/Quartal/Jahr/Gesamt
- [x] 6 Tabs: Übersicht, Buchungen, Kassenbuch, Offene Posten, Monatsabschluss, USt/MwSt

### E-Mail Module
- [x] IMAP Posteingang with auto-classification
- [x] Versandprotokoll: Rückstandslos löschen, Neu bearbeiten & senden, Adresse prüfen

### Anfragen
- [x] 4-Stufen Status: Ungelesen → Gelesen → Zu bearbeiten → Erledigt
- [x] Dynamic categories, VCF import, Quick notes

### Document Editor (WYSIWYG)
- [x] 3-column layout, Drag & Drop, Profi-Kalkulation
- [x] Title groups, Leistungsblöcke, DIN 5008 letterhead, Document Preview A4

### Other Features
- [x] Customer management, Quotes/Orders/Invoices CRUD
- [x] PDF generation, Email sending, Mahnwesen
- [x] Einsatzplanung, Kundenportale, Website-Integration

---

## Prioritized Backlog

### P1 – High Priority
- [ ] Bank Integration: N26 CSV-Import / Open Banking → automatischer Abgleich mit Rechnungen
- [ ] Landing Page IONOS FTP Upload (retry)

### P2 – Medium Priority
- [ ] Windows Desktop App (Electron wrapper)

### P3 – Low Priority
- [ ] SettingsPage refactoring
- [ ] WysiwygDocumentEditor refactoring (>2100 lines)
- [ ] Auftrags-Status-Workflow

### Future / On Request
- [ ] Lexoffice-Anbindung (Löhne)
- [ ] DATEV-Export
- [ ] Soll/Haben doppelte Buchführung

---

## Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── buchhaltung.py      ← Accounting: CRUD, Kassenbuch, Plausibilität, CSV-Export, Monatsabschluss
│   │   ├── email.py, imap.py
│   │   ├── invoices.py, quotes.py, orders.py
│   │   └── settings.py, articles.py
├── frontend/
│   └── src/pages/
│       ├── BuchhaltungPage.jsx  ← 6 Tabs + HilfeOverlay + Plausibilitätsprüfung
│       ├── EmailLogPage.jsx, EmailInboxPage.jsx, EmailPage.jsx
│       ├── AnfragenPage.jsx
│       └── ...
```

## 3rd Party Integrations
- OpenAI GPT-5.2 (Emergent LLM Key)
- SMTP Email Sending (User Credentials)
- IMAP Email Fetching (User Credentials)
