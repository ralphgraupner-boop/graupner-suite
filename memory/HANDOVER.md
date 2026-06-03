# HANDOVER — Stand Feierabend 31.05.2026, 18:23 Hamburger Zeit

Diese Datei ist die schnelle Übergabe für den morgigen Start. Vollständiges PRD: `PRD.md`.

---

## 🌅 Morgen zuerst — Pflicht-Checks

1. **Deploy-Historie prüfen** (Regel 11): Was wurde gestern auf Live deployt? Status aktuell auf Live?
2. **Service-Worker-Cache**: Sollte Ralph noch Reste vom F1-System sehen, bitte Hard-Refresh empfehlen (Strg+Shift+R)
3. **Hamburger Zeit** in jeder Antwort
4. **Plan vor Code** ausnahmslos (Regel 1)

---

## ✅ Was heute (31.05.2026) erledigt wurde — chronologisch

| Zeit (MEZ) | Thema | Status |
|---|---|---|
| ~11:50 | Anrede-Vorschlag-Box im WYSIWYG-Editor + Revert AnredeQuickEditModal | ✅ E2E |
| ~14:30 | AufgabenPanel: gesamte Zeile klickbar + F1-Hilfe-System global (5 Module) | ✅ E2E |
| ~14:55 | Backend-Fix: `VALID_DOC_TYPES`/`VALID_TEXT_TYPES` um Hilfe-Typen erweitert | ✅ curl |
| ~15:35 | Projektwerkbank wird Zentrale: CustomerDocumentsPanel ausgelagert, Mailverlauf/Portal/Einsatz-Buttons | ✅ E2E |
| ~15:58 | Tab-System in ProjektKarte (Details/Aufgaben/Termine/Bilder) + Kunden-Ebene umbenannt | ✅ E2E |
| ~16:15 | Live-Counts + Offen-Dot in Projekt-Tabs (`projekt_id`/`kunde_id` in Stats-Endpunkten) | ✅ E2E |

Letzter Git-Commit-Hash zu Beginn: `7a76265 — Auto-generated changes`

---

## 📋 Morgen-Agenda (priorisiert)

### 🔴 P0 — Public Contact API Phase 1
- Modul `module_public_api` für Jimdo-Kontaktformulare
- Offene Klärungspunkte: Cloudflare Turnstile? Push-Notification bei eingehender Anfrage?
- **Erst Plan vorlegen** (Endpoints, Authentifizierung, Rate-Limiting)

### 🟠 P1 — Editor + Backend lernen `projekt_id` zu speichern
- Aktuell wird `?projekt_id=` zwar in der URL übergeben (vom „Angebot"-Button in der Projekt-Karte), aber **nicht gespeichert**
- Ziel: Angebote/Aufträge/Rechnungen haben persistente `projekt_id`, sodass die Werkbank diese Dokumente pro Projekt anzeigen kann
- Touched: `models.py` (QuoteModel, OrderModel, InvoiceModel), `module_angebote/routes.py`, `module_auftraege/routes.py`, `module_rechnungen/routes.py`, `WysiwygDocumentEditor.jsx`
- **Erst Plan vorlegen** — Migration für bestehende Dokumente?

### 🟠 P1 — Navigation „← Zurück zu Werkbank [Name]"
- Aktuell: Detailseiten (Editor, ProjektDetail, MonteurEinsatzDetail, DokumenteV2Detail, PortalsPage) gehen beim Zurück-Button zur **Modul-Liste**, nicht zum Kunden/zur Werkbank
- Konzept: `?returnTo=...` URL-Param + wiederverwendbarer `<BackToContextButton />`
- Analyse liegt bereits vor (siehe heutiges Gespräch)

### 🟠 P1 — Backend Pytest-Suite aktualisieren
- 19 Errors wegen veralteter Credentials (`token` vs. `access_token`, alte Demo-User)
- Wirkt auf `/app/backend/tests/test_wysiwyg_editor.py` und ähnliche

### 🟡 P2 — Sidebar Offen-Indikatoren pro Sub-Sektion (heute neu aufgenommen)
- Am aktuell geöffneten Modul ein Mini-Dot pro Sub-Sektion, ergänzend zu globalen Sidebar-Zahlen

### 🟡 P2 — F1-Hilfe für weitere Module
- Mail-Inbox, Buchhaltung, Monteur-App, Dokumente
- Defaults in `lib/helpContent.js` ergänzen + `useF1Help` in den Seiten einbinden

### 🟡 P2 — Datum-Filter für Kunden-Liste
- „Heute / 7T / 30T / Zeitraum" — Daten (`created_at`) liegen vor

### 🟡 P2 — 12 kaputte Umlaute in `module_textvorlagen` (Live-DB)
- Migrations-Skript, nur nach DB-Snapshot

---

## 🧱 Wichtige offene Themen / Bekannte Punkte

- **Quote A-2026-0015** auf Preview wurde am 30.05. durch Agent versehentlich überschrieben — Wiederherstellung steht beim User offen, kein blockierendes Thema.
- **Service-Worker-Cache** kann F1 verzögert anzeigen → Hard-Refresh empfehlen
- **Live-Deploy**: Vor jedem Live-Push DB-Snapshot per Mail an support@emergent.sh anfragen (Plattform hat aktuell keinen Self-Service-Snapshot)

---

## 🔑 Test-Zugang Preview

- URL: `https://tischlerei-suite.preview.emergentagent.com`
- User: `admin-preview` / `HamburgPreview2026!`

## 🎯 Live-Umgebung

- URL: `https://code-import-flow-1.emergent.host`
- Bei Bugs IMMER zuerst klären: „Preview oder Live?"

---

## 📁 Wichtige Dateien (heute angefasst)

| Datei | Zweck |
|---|---|
| `frontend/src/components/CustomerDocumentsPanel.jsx` | NEU — Dokumente-Hub für Kunde+Projekt |
| `frontend/src/components/HelpSlideOver.jsx` | NEU — F1-Hilfe-Slide-Over |
| `frontend/src/lib/useF1Help.js` | NEU — F1-Hook |
| `frontend/src/lib/helpContent.js` | NEU — Default-Hilfetexte |
| `frontend/src/pages/projekte/ProjektWerkbank.jsx` | Zentrale, Tab-System, Live-Counts |
| `frontend/src/pages/KundenModulPage.jsx` | Schlanker (~237 Zeilen weg) |
| `frontend/src/components/AufgabenPanel.jsx` | Zeile klickbar, Prop `onlyWithoutProjekt` |
| `frontend/src/components/TerminePanel.jsx` | Prop `onlyWithoutProjekt` |
| `backend/module_aufgaben/routes.py` | Stats mit `projekt_id`/`kunde_id` |
| `backend/module_termine/routes.py` | Stats mit `projekt_id`/`kunde_id` |
| `backend/module_textvorlagen/routes.py` | Hilfe-Typen erlaubt |

---

## 🔁 Empfohlener Start morgen

1. PRD.md kurz lesen
2. Diese HANDOVER.md lesen
3. Ralph fragen: „Worauf willst du heute starten? Hier die Optionen aus dem Plan:" mit a/b/c/...
4. Erst nach „Ja" Code anfassen
5. Niemals Werbung. Niemals Plan-Bestätigung übergehen.

Guten Feierabend, Ralph. 👋
