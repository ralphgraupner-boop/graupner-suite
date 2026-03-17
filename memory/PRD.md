# Graupner Suite - Product Requirements Document

## Original Problem Statement
Komplette Handwerker-Management-Software für eine Tischlerei (Graupner). Ersetzt bestehende Software "Graupner intern" und Baufaktura durch eine einheitliche Lösung mit:
- Kundenmanagement inkl. Website-Kontaktformular-Integration
- KI-gestützte Angebotserstellung per Spracheingabe
- Auftragsbestätigungen und Rechnungen
- PDF-Export und E-Mail-Versand
- WYSIWYG-Dokumenteneditor (wie "Top-Kontor")

## User Personas
1. **Tischlermeister** - Erstellt Angebote, verwaltet Aufträge, schreibt Rechnungen
2. **Büroangestellte** - Verwaltet Kundendaten, verschickt Dokumente

## Core Requirements (Static)
- [x] Passwortgeschützter Zugang (JWT Auth)
- [x] Kundenmanagement (CRUD) mit Kundentyp
- [x] Artikelstamm (Materialien/Produkte)
- [x] Leistungsstamm (Arbeitsleistungen/Dienstleistungen)
- [x] Angebotserstellung mit Positionen
- [x] WYSIWYG-Dokumenteneditor für alle Dokumenttypen
- [ ] Spracheingabe → KI-Angebot (OpenAI GPT-5.2 + Whisper) - Backend ready, Frontend UI ready, API Key needed
- [x] Auftragsbestätigung aus Angebot
- [x] Rechnungen mit fortlaufender Nummer
- [x] MwSt auswählbar (19% / 7% / Kleinunternehmer)
- [x] PDF-Generierung für alle Dokumente
- [x] Dashboard mit Statistiken
- [x] Einstellungen für Firmendaten
- [x] Webhook für Website-Kontaktformular
- [x] Dokumentenvorschau (In-List Preview)
- [x] Universelle Bearbeitung für alle Dokumenttypen
- [x] Proportionale Gesamtsummenanpassung
- [x] Anzahlungen bei Rechnungen

## What's Been Implemented

### WYSIWYG Editor (Fertiggestellt 19.02.2026)
- Vollständiger WYSIWYG-Editor für Angebote, Aufträge und Rechnungen
- Neue Dokumente erstellen und bestehende bearbeiten
- Kundenauswahl mit Vorauswahl über URL-Parameter (?customer=id)
- Inline-Bearbeitung von Positionen direkt im Dokument
- Leistungen und Artikel aus Stammdaten einfügen
- MwSt-Auswahl, Anzahlungen, Status-Verwaltung
- PDF-Download direkt aus dem Editor
- Spracheingabe-UI integriert (Backend-Integration pending)
- Alte Modal-basierte Bearbeitungsformulare durch WYSIWYG ersetzt

### Backend (FastAPI + MongoDB)
- Auth-System mit JWT (Register/Login)
- Kunden-CRUD
- Artikelstamm-CRUD & Leistungsstamm-CRUD
- Angebote, Aufträge, Rechnungen CRUD mit fortlaufender Nummerierung
- PDF-Generierung mit ReportLab
- Speech-to-Text Endpoint (OpenAI Whisper) - bereit, API Key fehlt
- KI-Angebotserstellung Endpoint (GPT-5.2) - bereit, API Key fehlt
- Dashboard-Statistiken
- Einstellungen-Verwaltung
- Webhook-Endpoint für Kontaktformular

### Frontend (React + Tailwind)
- Login/Register mit Werkstatt-Bild
- Dashboard mit Statistiken und Schnellaktionen
- Kunden-Verwaltung mit Suchfunktion
- WYSIWYG-Editor für alle 3 Dokumenttypen
- Dokumentenlisten mit Vorschau, PDF-Download, Bearbeiten
- Artikelstamm & Leistungsstamm Verwaltung
- Firmeneinstellungen

### Design
- Industrial Swiss Design (Manrope + Barlow Condensed)
- Farben: Forest Green (#14532D) + Safety Orange (#F97316)
- Deutsche Sprache durchgehend

## Test Results (19.02.2026)
- Backend: 100% (20/21 Tests, 1 übersprungen)
- Frontend: 100% (alle WYSIWYG-Flows getestet)

## Prioritized Backlog

### P0 (Kritisch)
- [x] MVP abgeschlossen
- [x] Artikelstamm + Leistungsstamm getrennt
- [x] WYSIWYG-Dokumenteneditor fertiggestellt

### P1 (Wichtig)
- [ ] Spracheingabe aktivieren (Emergent LLM Key für OpenAI Whisper + GPT)
- [ ] E-Mail-Versand aktivieren (RESEND_API_KEY benötigt)
- [ ] Webhook-Dokumentation für Website-Integration

### P2 (Nice-to-have)
- [ ] Auftrags-Status-Workflow (In Arbeit, Fertig)
- [ ] Rechnungs-Mahnwesen
- [ ] Statistik-Charts im Dashboard
- [ ] Druckansicht für Dokumente
- [ ] Foto-Upload für Kundenanfragen

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Axios, Sonner (Toasts)
- **Backend**: FastAPI, Motor (MongoDB async), ReportLab (PDF)
- **KI**: OpenAI GPT-5.2, Whisper (Speech-to-Text) - geplant
- **Auth**: JWT mit bcrypt
- **Datenbank**: MongoDB

## Code Architecture
```
/app/
├── backend/
│   └── server.py          # Monolithic FastAPI with all endpoints
├── frontend/
│   └── src/
│       ├── App.js          # All components + routes (monolith)
│       └── components/ui/  # Shadcn UI components
└── memory/
    └── PRD.md
```

## Next Tasks
1. Spracheingabe mit Emergent LLM Key aktivieren
2. E-Mail-Integration mit Resend API Key
3. Webhook-Dokumentation erstellen
