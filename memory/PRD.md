# PRD - Graupner Suite (Handwerker-Software)

## Original Problem Statement
Complete craftsman management software ("Graupner Suite") for a carpentry business.

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI
- Backend: FastAPI, Motor (async MongoDB)
- Database: MongoDB
- LLM: OpenAI GPT-5.2 via Emergent LLM Key

## Completed Features (as of 2026-04-06)
- [x] Dashboard, Customer Management, Anfragen Inbox
- [x] Documents: Angebote, Aufträge, Rechnungen with WYSIWYG Editor
- [x] DIN 5008 PDF, Letterhead, Leistungsblöcke, Title Groups
- [x] Mahnwesen (Dunning), E-Mail Dialog
- [x] Self-Service Customer Portal with Push Notifications
- [x] Einsatzplanung Phase 1 + Phase 2
- [x] IMAP E-Mail-Empfang (manuell + Auto-Polling)
- [x] 1-Click Kundenportal-Erstellung + Auto-E-Mail-Einladungen
- [x] WysiwygDocumentEditor Refactoring (10 Sub-Komponenten)
- [x] Artikelkalkulation im Editor-Sidebar (EK, Zeitanteile, Zuschläge)
- [x] Kalkulationseinstellungen (Lohnstufen global konfigurierbar)
- [x] Kalkulationshistorie (pro Artikel gespeichert + vorausgefüllt)
- [x] Profi-Kalkulation in Artikel-Seite (2-Spalten-Modal)
- [x] Dashboard Pill Badges + Anfragen Modal
- [x] **Positions-Kalkulation per Klick**: Calculator-Icon auf jeder Position, KalkulationPanel öffnet sich rechts und bleibt offen, VK-Preis wird direkt in Position übernommen
- [x] **Vorlagen-Button**: In Toolbar oben (neben Einstellungen), togglet Vorlagen-Ansicht in rechter Sidebar
- [x] **Rechte Sidebar umgebaut**: Tab-Bar entfernt, klick-basierte Kalkulation + Dokument-Kalkulation + Übersicht

## Key API Endpoints
- `POST /api/kalkulation` - Kalkulation speichern
- `GET /api/kalkulation/{article_id}` - Historie (max 20)
- `GET /api/kalkulation/{article_id}/latest` - Letzte Kalkulation

## Backlog
- P1: N26 Bank Integration (CSV-Import / Open Banking)
- P2: Windows Desktop App (Electron wrapper)
- P3: SettingsPage Refactoring (>1.100 Zeilen)

## 3rd Party Integrations
- OpenAI GPT-5.2 via Emergent LLM Key
- SMTP Email, IMAP Email, Push API
