# Graupner Suite - PRD

## Problemstellung
Komplette Handwerker-Software ("Graupner Suite") für eine Tischlerei. Ersetzt alte disconnected Software. Enthält Kundenverwaltung, WYSIWYG-Dokumenteditor, KI-Sprachangebote, Finanzen und ein Lead-Relay-System.

## Architektur
- **Frontend**: React + Tailwind CSS + Recharts + Shadcn UI
- **Backend**: FastAPI + Motor (async MongoDB)
- **Email**: smtplib via Jimdo SMTP (secure.emailsrvr.com)
- **Entfernungen**: OpenStreetMap (Nominatim + OSRM) - kostenlos
- **KI**: OpenAI GPT-5.2 & Whisper via Emergent LLM Key

## Code-Architektur (nach Refactoring v2.0)
```
/app/backend/
├── server.py (65 Zeilen - Entry Point)
├── database.py (MongoDB, Konfiguration)
├── models.py (Pydantic Models)
├── auth.py (JWT Auth Middleware)
├── routes/
│   ├── auth.py, customers.py, articles.py
│   ├── services.py, quotes.py, orders.py
│   ├── invoices.py, email.py, settings.py
│   ├── push.py, webhook.py, documents.py
│   ├── distance.py, ai.py, pdf.py, dashboard.py
└── utils/
    ├── __init__.py (send_email)
    └── pdf_generator.py

/app/frontend/src/
├── App.js (77 Zeilen - Routing)
├── lib/ (api, auth, constants, push)
├── components/
│   ├── common/index.jsx (Button, Input, Card, Modal, Badge, etc.)
│   ├── layout/Navigation.jsx (Sidebar, MobileNav)
│   ├── DocumentPreview.jsx
│   ├── EditDocumentModal.jsx
│   └── WysiwygDocumentEditor.jsx
└── pages/ (14 Page-Komponenten)
```

## Implementierte Features
- [x] Login / Auth (JWT, auto admin-create)
- [x] Dashboard mit Charts, Warnungen, gestaffelter Übersicht
- [x] Kundenverwaltung mit Status, Kategorien, Suche/Filter
- [x] Anfragen-System (5 Kategorien, 1-Click Umwandlung)
- [x] Kunde auf Anfrage zurücksetzen (Revert)
- [x] WYSIWYG 3-Spalten Dokumenteditor (Angebote/Aufträge/Rechnungen)
- [x] KI-Sprachangebote (Whisper + GPT-5.2)
- [x] Artikel- & Leistungsverwaltung (CRUD)
- [x] Mahnwesen (3-stufig) mit PDF & E-Mail
- [x] E-Mail-Versand via SMTP + Protokollierung
- [x] Automatische Wiedervorlage (7 Tage)
- [x] Fälligkeits-Warnsystem mit Push-Notifications
- [x] Fahrtkosten-Berechnung (OpenStreetMap)
- [x] Website-Integration (Webhook + Relay zu Legacy-System)
- [x] PDF-Generierung für alle Dokumenttypen
- [x] Code-Refactoring Backend (65 Zeilen server.py)
- [x] Code-Refactoring Frontend (77 Zeilen App.js)
- [x] Anfragen bearbeitbar (Edit-Modal + PUT-Endpoint)
- [x] Schnellnotiz-Funktion (Inline-Eingabe direkt in Anfragen-Liste)
- [x] Textbausteine (Vortext/Schlusstext) mit Aliase-System für Angebote, Aufträge, Rechnungen — 02.04.2026
- [x] Automatische Anrede-Auflösung: {anrede_brief} → "Sehr geehrter Herr/Sehr geehrte Frau [Nachname]" — 02.04.2026
- [x] Vereinheitlichte Stammdaten-Datenbank: Artikel/Leistung/Fremdleistung mit 3 VK-Preisen (EK + %-Aufschlag), Subunternehmer-Feld, Migration bestehender Daten — 02.04.2026
- [x] VCF-Import: Upload von vCard-Dateien als Anfragen (Name, Anrede, E-Mail, Telefon, Adresse, Kategorien, Nachricht automatisch geparst) — 02.04.2026
- [x] WYSIWYG Sidebar: Stammdaten-Einfügung in Positionen funktioniert — 02.04.2026

## Implementierte Features (Aktuell)
- [x] Anfragen bearbeitbar (PUT /api/anfragen/{id}, Edit-Modal mit allen Feldern) — 02.04.2026
- [x] Schnellnotiz-Funktion (Inline-Eingabe mit Timestamp in Anfragen-Liste) — 02.04.2026
- [x] Textbausteine-System: Zentrale Verwaltung in Einstellungen (CRUD pro Dokumenttyp), Vortext/Schlusstext-Auswahl im WYSIWYG-Editor, Aliase ({kunde_name}, {firma}, {datum} etc.) mit automatischer Auflösung — 02.04.2026

## Implementierte Features (Landing Page)
- [x] Standalone Landing Page (`/app/landing_page/index.html`) für `schiebetür-reparatur-hamburg.de` — 02.04.2026
  - Hero-Sektion mit Hintergrundbild, CTAs und Statistiken (60+ Jahre, Hamburg, 24h)
  - 4 Leistungen: Schiebetür-Reparatur, Fenster & Türen, Schiebekipptüren, Wartung
  - Über-uns-Sektion mit Werkstatt-Bild und USPs (Meisterbetrieb, Reaktionszeit, Faire Preise)
  - Kontaktformular mit Themen-Auswahl (POST an Graupner Suite API)
  - CORS-Fallback via Bild-Beacon bei externem Hosting
  - Impressum & Datenschutz als Modals
  - Responsive Design (Desktop, Tablet, Mobil)
  - Backend-Preview unter `/api/landing-page`
  - Datei bereit für IONOS FTP-Upload

## Implementierte Features (Einstellungen Umbau)
- [x] Tab-basierte Einstellungen mit 5 Bereichen — 02.04.2026
  - Firmendaten: Firmendaten, Bankverbindung, Steuer, Fahrtkosten, Zahlungsziele
  - Textbausteine: Vortext/Schlusstext/Bemerkung pro Dokumenttyp (NEU: Bemerkungsfeld)
  - E-Mail: SMTP-Konfiguration über UI (mit Verbindungstest) + Push-Benachrichtigungen
  - Benutzer-Verwaltung: Benutzer anlegen, Passwort ändern, löschen
  - Dokument-Vorlagen: PDF-Layout (Kopf-/Fußzeile, Bemerkung, Farbe, Schriftgröße, Logo)
- [x] Backend-Erweiterung: GET/POST/DELETE /api/users, PUT /api/users/{username}/password
- [x] Backend-Erweiterung: POST /api/settings/smtp-test
- [x] CompanySettings Model erweitert um SMTP, PDF-Layout und Bemerkungsfelder
- [x] PDF-Download Bug behoben: Token wird korrekt mitgesendet (api.get statt axios.get)

## Backlog
- [ ] E-Mail-Empfang via IMAP (service24@tischlerei-graupner.de → Anfragen)
- [ ] N26 Bankanbindung (CSV-Import / Open Banking)
- [ ] Windows Desktop App (Electron)
- [ ] Auftrags-Status-Workflow
- [ ] Druckansicht für Dokumente
- [ ] PDF Textbausteine (Vortext/Schlusstext in PDFs)
