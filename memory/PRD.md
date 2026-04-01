# Graupner Suite - Product Requirements Document

## Original Problem Statement
Komplette Handwerker-Management-Software für eine Tischlerei (Graupner). Ersetzt bestehende Software und bietet:
- Kundenmanagement inkl. Anfragen-System mit Kategorien
- KI-gestützte Angebotserstellung per Spracheingabe
- WYSIWYG-Dokumenteneditor (3-Spalten: Leistungen, Dokument, Kalkulation)
- Mahnwesen für überfällige Rechnungen
- E-Mail-Versand (SMTP) mit Protokoll
- Dashboard mit Charts & Fälligkeitswarnungen
- Lead-Relay-System für Jimdo-Website → Graupner-Intern CRM

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: FastAPI, Motor (MongoDB async), ReportLab (PDF), smtplib (Email)
- **KI**: OpenAI GPT-5.2, Whisper via Emergent LLM Key
- **Auth**: JWT mit bcrypt
- **DB**: MongoDB
- **SMTP**: secure.emailsrvr.com:465 SSL (service24@tischlerei-graupner.de)

## Completed Features

### Anfragen-System (30.03.2026)
- Eigener "Anfragen"-Reiter, 5 Kategorien, Ein-Klick-Übernahme, Filter

### Mahnwesen (31.03.2026)
- 3 Mahnstufen, Mahnungs-PDF, Tab auf Rechnungsseite

### Dashboard Charts (31.03.2026)
- BarChart (Umsatz 6 Monate), PieChart (Rechnungsstatus)

### EK-Preise in Stammdaten (31.03.2026)
- Einkaufspreise, Marge-Berechnung, Auto-fill im Editor

### Firmendaten in PDFs (31.03.2026)
- 3-Spalten-Fußzeile auf allen Dokumenttypen

### Fälligkeits-Warnsystem (01.04.2026)
- Push-Benachrichtigungen, Warn-Banner auf Dashboard

### E-Mail-Versand (01.04.2026)
- SMTP-Integration, Dokumente + Mahnungen als PDF per E-Mail

### E-Mail-Protokoll (01.04.2026)
- Eigener Reiter "E-Mail-Protokoll" mit Gesamtübersicht + Suche
- Versandhistorie in DocumentPreview (bei jedem Dokument)
- Automatisches Logging bei jedem Versand (Status: gesendet/fehlgeschlagen)

### Weitere Features (bereits implementiert)
- JWT Auth, Kundenmanagement mit Kategorien
- Artikel/Leistungsstamm mit EK-Preisen
- Angebote, Aufträge, Rechnungen (CRUD + PDF)
- WYSIWYG-3-Spalten-Editor mit Drag & Drop
- KI-Spracheingabe (GPT-5.2 + Whisper)
- Kontaktformular-Relay, Webhook, Push, PWA

## Prioritized Backlog

### P2
- [ ] Code-Refactoring (App.js + server.py aufteilen)

### P3 (Zukunft)
- [ ] Bankanbindung (CSV-Import oder Open Banking)
- [ ] Auftrags-Status-Workflow
- [ ] Druckansicht für Dokumente
