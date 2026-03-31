# Graupner Suite - Product Requirements Document

## Original Problem Statement
Komplette Handwerker-Management-Software für eine Tischlerei (Graupner). Ersetzt bestehende Software und bietet:
- Kundenmanagement inkl. Anfragen-System mit Kategorien
- KI-gestützte Angebotserstellung per Spracheingabe
- WYSIWYG-Dokumenteneditor (3-Spalten: Leistungen, Dokument, Kalkulation)
- Mahnwesen für überfällige Rechnungen
- Dashboard mit Charts
- Lead-Relay-System für Jimdo-Website → Graupner-Intern CRM

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Recharts, Lucide Icons
- **Backend**: FastAPI, Motor (MongoDB async), ReportLab (PDF)
- **KI**: OpenAI GPT-5.2, Whisper (Speech-to-Text) via Emergent LLM Key
- **Auth**: JWT mit bcrypt
- **DB**: MongoDB

## Completed Features

### Anfragen-System (30.03.2026)
- Eigener "Anfragen"-Reiter, Kategorien: Schiebetür, Fenster, Innentür, Eingangstür, Sonstige Reparaturen
- Ein-Klick-Übernahme zu Kunde, Löschen, Kategorie-Filter

### Mahnwesen (31.03.2026)
- Überfällige Rechnungen automatisch erkennen
- 3 Mahnstufen: Zahlungserinnerung → 1. Mahnung → Letzte Mahnung
- Mahnungs-PDF generieren und herunterladen
- Tab "Mahnwesen" auf Rechnungsseite mit Badge-Zähler

### Dashboard Charts (31.03.2026)
- Recharts BarChart: Monatlicher Umsatz (Angebote + Rechnungen, 6 Monate)
- Recharts PieChart: Rechnungsstatus-Verteilung (Donut)
- Überfällig-Warnung mit Link
- Statistik-Kacheln: Anfragen, Kunden, Angebote, Aufträge, Rechnungen

### EK-Preise in Stammdaten (31.03.2026)
- Einkaufspreise bei Artikeln und Leistungen
- Marge-Berechnung in Echtzeit (Modal + Karten)
- Auto-fill costPrices im WYSIWYG-Editor beim Drag & Drop

### Firmendaten in PDFs (31.03.2026)
- 3-Spalten-Fußzeile: Firma/Inhaber/Adresse | Tel/E-Mail/St.-Nr. | Bank/IBAN/BIC
- Auf ALLEN Dokumenttypen (Angebote, Aufträge, Rechnungen)
- Fälligkeitsdatum bei Rechnungen, Gültigkeitsdatum bei Angeboten

### Weitere Features (bereits implementiert)
- [x] JWT Auth mit Admin-Login
- [x] Kundenmanagement (CRUD) mit Kategorien
- [x] Artikelstamm und Leistungsstamm
- [x] Angebote, Aufträge, Rechnungen (CRUD + PDF)
- [x] WYSIWYG-3-Spalten-Editor mit Drag & Drop
- [x] KI-Spracheingabe (GPT-5.2 + Whisper)
- [x] Kontaktformular-Relay (HTML-Seite, Weiterleitung an Graupner-Intern)
- [x] Webhook für Website-Integration
- [x] Push-Benachrichtigungen (VAPID)

## Prioritized Backlog

### P1
- [ ] E-Mail-Versand (Resend API Key benötigt)

### P2
- [ ] Code-Refactoring (App.js 5800+ Zeilen, server.py 2000+ Zeilen aufteilen)

### P3 (Zukunft)
- [ ] Bankanbindung (CSV-Import oder Open Banking)
- [ ] Auftrags-Status-Workflow
- [ ] Druckansicht für Dokumente
