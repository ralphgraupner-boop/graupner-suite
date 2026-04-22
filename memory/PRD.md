# Graupner Suite – Product Requirements (PRD)

**Projekt:** Graupner Suite – Handwerker-Verwaltungssoftware für die Tischlerei R.Graupner
**Prinzip:** **Modulare Architektur — jedes Modul ist eigenständig (Module-First).**
**Live-URL:** https://code-import-flow-1.emergent.host
**Preview-URL:** https://handwerk-deploy.preview.emergentagent.com

---

## 🚨 ABSOLUTE REGEL FÜR ALLE ZUKÜNFTIGEN AGENTEN (Module-First)

Diese Regel steht **seit Projektbeginn (03.03.2026)** in diesem Dokument
und wurde am **21.04.2026 in einer formellen Beschwerde** (`/app/support_beschwerde_graupner.md`)
nach Credit-Verbrauch von **1.000 €** und Analyse der Git-Historie erneut durchgesetzt.

**Jedes neue Feature, jede neue Integration, jeder Helper MUSS in einem eigenen,
isolierten Ordner/Modul entstehen — mit eigenen Collections und Feature-Flag.**

### Konkret verboten:
- ❌ Änderungen an `utils/__init__.py` (SMTP-Kern) für neue Features
- ❌ Direkte Bearbeitung von `WysiwygDocumentEditor.jsx` (>1200 Zeilen, Core)
- ❌ Einbauen neuer Logik in `routes/portal.py`, `routes/webhook.py`, `DashboardPage.jsx`
- ❌ Hinzufügen neuer Helper-Funktionen in Core-Dateien

### Korrekt vorgehen:
- ✅ Neuer Ordner `/app/backend/<modulname>/` mit `__init__.py`, eigenen Routes, Models
- ✅ Eigene MongoDB-Collections mit Prefix (`portal2_*`, `rechnungen_v2_*`, …)
- ✅ Eigenes API-Prefix (`/api/portal-v2/*`, `/api/v2/*`, …)
- ✅ Feature-Flag in eigener Settings-Collection, toggelbar aus der UI
- ✅ Einzige erlaubte Änderung an Core: +1 Zeile Import + 1 Zeile `include_router` in `server.py`,
  +1 Menüpunkt in `Navigation.jsx`, +1–2 Routes in `App.js`
- ✅ Nur lesender Zugriff auf Bestands-Collections (`module_kunden`, `settings`)

### Begründung (aus Nutzer-Sicht):
*„Ich habe 1000 Euro ausgegeben und es wurde nicht gemacht. Die Beschwerde wurde
eingereicht. Ab jetzt wird es richtig gemacht."* — Ralph Graupner, 22.04.2026

---

## 🏗️ Architektur

- **Frontend:** React + Tailwind + Shadcn/ui
- **Backend:** FastAPI
- **DB:** MongoDB (Name: `graupner_suite`, auf Live separat)
- **Storage:** Emergent Object Storage (`utils/storage.py`)
- **Auth:** JWT (Suite-Nutzer) + separater JWT für Portal-v2-Kunden
- **Email:** SMTP (service24@tischlerei-graupner.de, IONOS)

---

## 📦 Aktuell existierende Module (Stand 22.04.2026)

### Core-Module (stabil, minimale Änderungen erlaubt)
- `routes/auth.py` — JWT-Login für Suite-Admin
- `routes/module_kunden.py` — Kundenkartei (26 Einträge live ~24)
- `routes/module_artikel.py` — Artikel & Leistungen
- `routes/module_dokumente.py` — Dokumente-Verwaltung
- `routes/module_textvorlagen.py` — Textvorlagen für Angebote/Mails
- `routes/modules.py` — Modul-Meta + Kontakt-Datenquelle (`module_kontakt`)
- `routes/einsaetze.py` — Einsatz-/Termin-Planung
- `routes/mitarbeiter.py` — Personal
- `routes/webhook.py` — Kontaktformular-Webhook (schreibt in `module_kunden`)
- `routes/anfragen.py` + `routes/anfragen_fetcher.py` — Anfragen-Modul & IMAP-Fetcher
- `routes/portal.py` — **Altes Portal** (weiterhin aktiv, ~10 Accounts live)

### Isolierte Module (Module-First)
- `routes/rechnungen_v2.py` — `/api/v2/*`, Collection `rechnungen_v2`
- `portal_v2/` — **Kundenportal v2** (NEU 22.04.2026, s. unten)

### Deaktivierte Module
- IMAP-Polling im Hintergrund → AUS (User nutzt Betterbird extern)
- E-Mail-Modul-Menü → hinter `email_module_enabled`-Flag versteckt

---

## ✅ Kundenportal v2 (fertig am 22.04.2026)

**Pfad Backend:** `/app/backend/portal_v2/`
**Pfad Frontend:** `/app/frontend/src/pages/portal_v2/`
**API-Prefix:** `/api/portal-v2/*`
**Feature-Flag:** `portal2_settings.feature_enabled`
**Menü:** „Kundenportal v2" (`/portal-v2`)

### Module-First-Einhaltung
- ✅ Null Änderungen an `portal.py`, `utils/__init__.py`, `webhook.py`, `DashboardPage.jsx`, `WysiwygDocumentEditor.jsx`
- ✅ Neue Collections: `portal2_accounts`, `portal2_messages`, `portal2_uploads`, `portal2_activity`, `portal2_settings`, `portal2_sync_log`
- ✅ Kern-Änderungen: +2 Zeilen in `server.py`, +1 Menüpunkt in `Navigation.jsx`, +4 Routes in `App.js`

### Features (MVP komplett)
- **Phase 1 (Gerüst + CRUD):** Account anlegen/editieren/löschen, Settings-Panel mit Feature-Toggle
- **Phase 2 (Import):** Bulk-Import aus `module_kunden` (nur lesend), mit Dubletten-Check + Sync-Log
- **Phase 3 (Auth):** Auto-generierte Passwörter (bcrypt), Token-Link-Login, Einladungs-Mail (eigener `mail_builder.py`)
- **Phase 4 (Chat):** Beidseitiger Chat Admin↔Kunde, Lese-Status, Badges
- **Phase 5 (Uploads):** Datei-Upload Bilder+PDF, HEIC→JPEG, Rate-Limit (20/h default)

### Struktur
```
portal_v2/
├── __init__.py          # Router
├── models.py            # Pydantic
├── auth.py              # Passwort/Token/bcrypt/JWT-Session
├── database.py          # (nicht genutzt, db aus database.py)
├── routes_admin.py      # Admin-CRUD, Invite, Reset-Password
├── routes_customer.py   # Public: Login, Preflight, Me
├── sync.py              # Import aus module_kunden
├── messages.py          # Chat
├── uploads.py           # Dateien
└── mail_builder.py      # Einladungs-HTML (mit Anrede-Brief)
```

### Frontend-Seiten
```
pages/portal_v2/
├── PortalV2AdminPage.jsx       # Admin-Übersicht (Menüpunkt)
├── PortalV2ImportDialog.jsx    # Import-Modal
├── PortalV2DetailPage.jsx      # Admin: Chat + Galerie pro Account
├── PortalV2LoginPage.jsx       # Public: /portal-v2/login/:token?
└── PortalV2CustomerPage.jsx    # Public: /portal-v2/app (nach Login)
```

---

## 📋 Aktuelle Prioritäten / Backlog

### P0 (offen vor 22.04.)
- Chrome Push-Notifications „Angebots-Wiedervorlage" Spam
  → Feature-Flag zum Abschalten oder SW-Cleanup-Button
  → Status: PAUSIERT (User hat Thema ruhen gelassen, Fokus Portal v2)

### P1 (nach Portal v2 MVP)
- **Portal v2 – Phase 6 (Polish):**
  - Ungelesen-Badge im Sidebar-Menü (`GET /api/portal-v2/admin/unread-summary` ist schon da)
  - E-Mail-Notification an Admin, wenn Kunde Nachricht/Upload sendet
  - Passwort-Vergessen-Flow
  - Dokumente-Tab (Admin kann PDFs für Kunden hochladen – teilweise schon da)
- PDF-Archiv-Modul (GoBD-konform, Dokumente in Object Storage)
  → als isoliertes Modul `/app/backend/pdf_archiv/`
- Live-Test des gesamten Portal-v2-Flows mit echtem Kunden

### P2 (Backlog)
- Automatische Kundennummern (`G210426/0625`)
- Stundenplan-Kontrolle (BLOCKED: PDF-Beispiel vom User fehlt)
- SEO/Ranking-Modul
- DATEV-Export
- Monteur-PWA / Handy-App

---

## 🔑 Wichtige Hinweise für neue Agenten

1. **Language:** ALLE Antworten auf DEUTSCH.
2. **Live vs Preview:** User arbeitet LIVE. Preview ist Test-Umgebung. DBs getrennt.
   → Nach Features: immer „Save to GitHub + Re-Deploy"-Hinweis.
3. **E-Mail:** Betterbird wird extern genutzt — kein Hintergrund-IMAP-Polling aktivieren!
4. **Kontaktdaten-Quelle:** `module_kunden` (NICHT `anfragen` oder `module_kontakt`).
   → Webhook-Eingang von `kontakt-graupner.de` schreibt in `module_kunden`.
5. **Erst ask_human, dann code:** Vor jeder Feature-Implementierung `ask_human` mit Plan.
6. **Credits respektieren:** User hat 1000 € bereits ausgegeben. Kein Refactoring ohne Bitte.

---

## 📝 Changelog der Session 22.04.2026

- ✅ Portal v2 Phase 1 (Gerüst + CRUD)
- ✅ Portal v2 Phase 2 (Import aus module_kunden)
- ✅ Portal v2 Phase 3 (Login + Einladungs-Mail, bcrypt, Token-Link)
- ✅ Portal v2 Phase 4 (Chat beidseitig)
- ✅ Portal v2 Phase 5 (Uploads mit HEIC, Rate-Limit)
- ✅ Live-getestet: Account, Invite, Login, Chat, Upload alle OK
- ✅ Beschwerde (1000 € Credits) an Support eingereicht

**Stand Abend 22.04.:** Portal v2 MVP komplett, Feature-Flag-steuerbar,
**Module-First zu 100 % eingehalten**, Live-Deploy durchgeführt.
