# Graupner Suite - Product Requirements Document

## Original Problem Statement
Komplette Handwerker-Management-Software für eine Tischlerei (Graupner).

## Tech Stack
- Frontend: React 19, Tailwind CSS, Recharts, Lucide Icons
- Backend: FastAPI, Motor (MongoDB async), ReportLab (PDF), smtplib (Email)
- KI: OpenAI GPT-5.2, Whisper via Emergent LLM Key
- Auth: JWT mit bcrypt
- DB: MongoDB
- SMTP: secure.emailsrvr.com:465 SSL

## Completed Features
- Anfragen-System mit 5 Kategorien (30.03.2026)
- Mahnwesen mit 3 Mahnstufen (31.03.2026)
- Dashboard Charts: BarChart + PieChart (31.03.2026)
- EK-Preise in Stammdaten mit Marge (31.03.2026)
- Firmendaten in PDFs (31.03.2026)
- Fälligkeits-Warnsystem mit Push (01.04.2026)
- E-Mail-Versand via SMTP (01.04.2026)
- E-Mail-Protokoll mit Versandhistorie (01.04.2026)
- Angebots-Wiedervorlage nach 7 Tagen (01.04.2026)
- Kunden-Statusfeld: Neu → In Arbeit → Angebot → Auftrag → Abgeschlossen (01.04.2026)
- OpenStreetMap-Link bei Kundenadresse (01.04.2026)
- Erweiterte Einstellungen: Fahrtkosten, Zahlungsziele, E-Mail-Signatur (01.04.2026)
- Gestaffelte Dashboard-Übersicht: Anfragen/Kunden/Leistungen (01.04.2026)
- WYSIWYG 3-Spalten-Editor, KI-Spracheingabe, Kontaktformular-Relay, Webhook, Push, PWA

## Prioritized Backlog

### P2
- [ ] Code-Refactoring (App.js + server.py aufteilen)
- [ ] Entfernungsberechnung mit OpenRouteService (Fahrtkosten automatisch)

### P3 (Zukunft)
- [ ] Bankanbindung (CSV-Import / Open Banking)
- [ ] Windows Desktop App (Electron)
- [ ] Auftrags-Status-Workflow
- [ ] Druckansicht für Dokumente
