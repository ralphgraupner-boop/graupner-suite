# Graupner Suite - Product Requirements Document

## Original Problem Statement
Komplette Handwerker-Management-Software für eine Tischlerei (Graupner). Ersetzt bestehende Software "Graupner intern" und Baufaktura durch eine einheitliche Lösung mit:
- Kundenmanagement inkl. Website-Kontaktformular-Integration
- KI-gestützte Angebotserstellung per Spracheingabe
- Auftragsbestätigungen und Rechnungen
- PDF-Export und E-Mail-Versand

## User Personas
1. **Tischlermeister** - Erstellt Angebote, verwaltet Aufträge, schreibt Rechnungen
2. **Büroangestellte** - Verwaltet Kundendaten, verschickt Dokumente

## Core Requirements (Static)
- [x] Passwortgeschützter Zugang
- [x] Kundenmanagement (CRUD)
- [x] Artikelstamm/Leistungskatalog
- [x] Angebotserstellung mit Positionen
- [x] Spracheingabe → KI-Angebot (OpenAI GPT-5.2 + Whisper)
- [x] Auftragsbestätigung aus Angebot
- [x] Rechnungen mit fortlaufender Nummer
- [x] MwSt auswählbar (19% / Kleinunternehmer)
- [x] PDF-Generierung für alle Dokumente
- [x] Dashboard mit Statistiken
- [x] Einstellungen für Firmendaten
- [x] Webhook für Website-Kontaktformular

## What's Been Implemented (17.03.2026)

### Backend (FastAPI + MongoDB)
- Auth-System mit JWT (Register/Login)
- Kunden-CRUD mit Fotos-Support
- Artikelstamm-CRUD
- Angebote mit Positionen, MwSt-Berechnung, fortlaufender Nummer (A-YYYY-NNNN)
- Aufträge aus Angeboten erstellen (AB-YYYY-NNNN)
- Rechnungen mit Fälligkeit und Bezahlt-Markierung (R-YYYY-NNNN)
- PDF-Generierung mit ReportLab
- Speech-to-Text mit OpenAI Whisper
- KI-Angebotserstellung mit GPT-5.2
- Dashboard-Statistiken
- Einstellungen-Verwaltung
- Webhook-Endpoint für Website-Kontaktformular

### Frontend (React + Tailwind)
- Login/Register-Seite mit Werkstatt-Bild
- Dashboard mit Statistiken und Schnellaktionen
- Kunden-Liste und Bearbeitung
- Angebotserstellung mit:
  - Kundenauswahl
  - Spracheingabe-Button
  - Positionen hinzufügen/bearbeiten
  - Artikelvorlagen einfügen
  - MwSt-Auswahl
- Aufträge-Übersicht mit Rechnung-Erstellung
- Rechnungen-Liste mit Bezahlt-Markierung
- Artikelstamm-Verwaltung
- Einstellungen für Firmendaten

### Design
- Industrial Swiss Design (Manrope + Barlow Condensed)
- Farben: Forest Green (#14532D) + Safety Orange (#F97316)
- Professionelles, seriöses Handwerker-Design
- Deutsche Sprache durchgehend

## Test Results
- Backend: 100% (30/30 Tests)
- Frontend: 95% (alle Kernfunktionen)

## Prioritized Backlog

### P0 (Kritisch)
- [x] MVP abgeschlossen

### P1 (Wichtig)
- [ ] E-Mail-Versand aktivieren (RESEND_API_KEY benötigt)
- [ ] Graupner-intern Webhook-Dokumentation
- [ ] Foto-Upload für Kundenanfragen

### P2 (Nice-to-have)
- [ ] Auftrags-Status-Workflow (In Arbeit, Fertig)
- [ ] Rechnungs-Mahnwesen
- [ ] Statistik-Charts im Dashboard
- [ ] Druckansicht für Dokumente

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Axios, Sonner (Toasts)
- **Backend**: FastAPI, Motor (MongoDB async), ReportLab (PDF)
- **KI**: OpenAI GPT-5.2, Whisper (Speech-to-Text)
- **Auth**: JWT mit bcrypt
- **Datenbank**: MongoDB

## Next Tasks
1. E-Mail-Integration mit Resend API Key vom Benutzer
2. Webhook-Dokumentation für Website-Integration erstellen
3. Foto-Upload für Kundenanfragen implementieren
