# Graupner Suite - Product Requirements Document

## Original Problem Statement
Komplette Handwerker-Management-Software für eine Tischlerei (Graupner). Ersetzt bestehende Software und bietet:
- Kundenmanagement inkl. Anfragen-System mit Kategorien
- KI-gestützte Angebotserstellung per Spracheingabe
- WYSIWYG-Dokumenteneditor (3-Spalten: Leistungen, Dokument, Kalkulation)
- Mahnwesen für überfällige Rechnungen
- E-Mail-Versand (SMTP)
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
- 3 Mahnstufen, Mahnungs-PDF, Tab auf Rechnungsseite mit Badge

### Dashboard Charts (31.03.2026)
- BarChart (Umsatz 6 Monate), PieChart (Rechnungsstatus), Statistik-Kacheln

### EK-Preise in Stammdaten (31.03.2026)
- Einkaufspreise bei Artikeln/Leistungen, Marge-Berechnung, Auto-fill im Editor

### Firmendaten in PDFs (31.03.2026)
- 3-Spalten-Fußzeile auf allen Dokumenttypen

### Fälligkeits-Warnsystem (01.04.2026)
- Automatische Erkennung bald fälliger Rechnungen (3 Tage)
- Push-Benachrichtigungen bei fälligen/überfälligen Rechnungen
- Warn-Banner auf Dashboard (Amber=bald fällig, Rot=überfällig)
- Auto-Status-Update auf "Überfällig"

### E-Mail-Versand (01.04.2026)
- SMTP-Integration (secure.emailsrvr.com:465 SSL)
- Dokumente (Angebote, Aufträge, Rechnungen) als PDF per E-Mail
- Mahnungen per E-Mail
- E-Mail-Button in Dokumentenvorschau mit Empfänger/Betreff/Nachricht
- E-Mail-Button im Mahnwesen-Tab

### Weitere Features (bereits implementiert)
- JWT Auth, Kundenmanagement mit Kategorien
- Artikel/Leistungsstamm mit EK-Preisen
- Angebote, Aufträge, Rechnungen (CRUD + PDF)
- WYSIWYG-3-Spalten-Editor mit Drag & Drop
- KI-Spracheingabe (GPT-5.2 + Whisper)
- Kontaktformular-Relay (Weiterleitung an Graupner-Intern)
- Webhook, Push-Benachrichtigungen, PWA

## Prioritized Backlog

### P2
- [ ] Code-Refactoring (App.js 5900+ Zeilen, server.py 2400+ Zeilen aufteilen)

### P3 (Zukunft)
- [ ] Bankanbindung (CSV-Import oder Open Banking)
- [ ] Auftrags-Status-Workflow
- [ ] Druckansicht für Dokumente
