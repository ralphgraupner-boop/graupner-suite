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
- [x] Kundenmanagement (CRUD) mit Kundentyp + Kategorien
- [x] Artikelstamm (Materialien/Produkte)
- [x] Leistungsstamm (Arbeitsleistungen/Dienstleistungen)
- [x] Angebotserstellung mit Positionen
- [x] WYSIWYG-Dokumenteneditor für alle Dokumenttypen
- [x] Spracheingabe → KI-Angebot (OpenAI GPT-5.2 + Whisper)
- [x] Auftragsbestätigung aus Angebot
- [x] Rechnungen mit fortlaufender Nummer
- [x] MwSt auswählbar (19% / 7% / Kleinunternehmer)
- [x] PDF-Generierung für alle Dokumente
- [x] Dashboard mit Statistiken + Anfragen-Übersicht
- [x] Einstellungen für Firmendaten
- [x] Webhook für Website-Kontaktformular
- [x] Anfragen-System mit Kategorien und Conversion

## What's Been Implemented

### Anfragen-System mit Kategorien (Fertiggestellt 30.03.2026)
- Neuer "Anfragen"-Reiter in der Navigation (zwischen Dashboard und Kunden)
- Kontaktformular-Eingänge landen in eigener "anfragen" Collection
- 5 Kategorien: Schiebetür, Fenster, Innentür, Eingangstür, Sonstige Reparaturen
- Ein-Klick-Übernahme: Anfrage → Kunde (mit Kategorien)
- Löschen-Button (X) zum Verwerfen von Anfragen
- Kategorie-Filter-Pills auf Anfragen- UND Kundenseite
- Dashboard: "Neue Anfragen" Statistik-Kachel + "Letzte Anfragen" Widget + Kategorien-Übersicht
- Kunden bekommen Kategorie-Feld (wird bei Übernahme mitgenommen)
- Kontaktformular aktualisiert mit neuen 5 Kategorien
- Alle 3 Eingangskanäle (Webhook, Kontaktformular-Relay, Beacon) speichern in anfragen
- Testing: 100% bestanden (iteration_6.json)

### 3-Spalten WYSIWYG Editor (Fertiggestellt 30.03.2026)
- Desktop 3-Spalten-Layout: Links Leistungen/Artikel, Mitte Dokument, Rechts Vorlagen+Kalkulation
- Drag & Drop von Leistungen/Artikeln ins Dokument
- Vorlagen-System und Kalkulations-Panel

### Öffentliches Kontaktformular-Relay (Fertiggestellt 30.03.2026)
- Öffentliche Kontaktseite unter /api/kontakt
- Speichert jetzt in anfragen-Collection + Push-Benachrichtigung
- Leitet alle Daten an original response.php weiter

### Weitere Features
- Webhook-Dokumentation & Website-Integration
- Push-Benachrichtigungen (VAPID)
- PWA / Mobile App
- IONOS Go-X Website-Builder Integration

## Tech Stack
- **Frontend**: React 19, Tailwind CSS, Axios, Sonner (Toasts)
- **Backend**: FastAPI, Motor (MongoDB async), ReportLab (PDF)
- **KI**: OpenAI GPT-5.2, Whisper (Speech-to-Text)
- **Auth**: JWT mit bcrypt
- **Datenbank**: MongoDB

## Prioritized Backlog

### P1 (Wichtig)
- [ ] E-Mail-Versand aktivieren (RESEND_API_KEY benötigt)

### P2 (Nice-to-have)
- [ ] Mahnwesen (Überfällige Rechnungen, Zahlungserinnerungen)
- [ ] Statistik-Charts im Dashboard
- [ ] EK-Preise in Stammdaten für automatische Kalkulation
- [ ] Firmendaten in PDF-Generierung integrieren

### P3 (Backlog)
- [ ] Auftrags-Status-Workflow (In Arbeit, Fertig)
- [ ] Druckansicht für Dokumente
- [ ] Code-Refactoring (App.js + server.py aufteilen)
