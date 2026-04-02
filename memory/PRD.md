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

## Backlog
- [ ] N26 Bankanbindung (CSV-Import / Open Banking)
- [ ] Windows Desktop App (Electron)
- [ ] Auftrags-Status-Workflow
- [ ] Druckansicht für Dokumente
