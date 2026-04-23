# Graupner Suite – Product Requirements (PRD)

**Projekt:** Graupner Suite – Handwerker-Verwaltungssoftware für die Tischlerei R.Graupner
**Prinzip:** **Modulare Architektur — jedes Modul ist eigenständig (Module-First).**
**Live-URL:** https://code-import-flow-1.emergent.host
**Preview-URL:** https://handwerk-deploy.preview.emergentagent.com

---

## 🚦 BRIEFING FÜR DEN NÄCHSTEN AGENTEN

### 🛑 SOFORT-ANWEISUNGEN (nicht übergehen!)

1. **Sprache: NUR DEUTSCH.**
2. **Der User Ralph Graupner hat am 21.04.2026 eine formelle Beschwerde wegen Module-First-Verletzung eingereicht.** → Jede Änderung an Core-Dateien ist verboten. Siehe „ABSOLUTE REGEL" unten.
3. **Portal v2 ist TABU** (siehe unten).
4. **Start der Session:** `ask_human` mit Plan und Bestätigung bevor du loslegst.

### 📅 Stand: 23.04.2026 Morgen

Dokumente v2 Phase 1+2+3 **komplett fertig und getestet** (28/28 Pytest grün, Frontend-Smoke OK). Live deployed.

Offen: Phase 4 (State-Machine Angebot→Auftrag→Rechnung), Phase 5 (optional Portal-Anbindung).

---

## 🚨 ABSOLUTE REGEL FÜR ALLE ZUKÜNFTIGEN AGENTEN (Module-First)

**Jedes neue Feature, jede neue Integration, jeder Helper MUSS in einem eigenen, isolierten Ordner/Modul entstehen — mit eigenen Collections und Feature-Flag.**

### Konkret verboten:
- ❌ Änderungen an `utils/__init__.py` (SMTP-Kern) für neue Features
- ❌ Direkte Bearbeitung von `WysiwygDocumentEditor.jsx` (>1200 Zeilen, Core)
- ❌ Einbauen neuer Logik in `routes/portal.py`, `routes/webhook.py`, `DashboardPage.jsx`

### Korrekt vorgehen:
- ✅ Neuer Ordner `/app/backend/<modulname>/` mit `__init__.py`, eigenen Routes, Models
- ✅ Eigene MongoDB-Collections mit Prefix (`portal2_*`, `dokumente_v2_*`, …)
- ✅ Eigenes API-Prefix (`/api/portal-v2/*`, `/api/dokumente-v2/*`, …)
- ✅ Feature-Flag in eigener Settings-Collection, toggelbar aus der UI
- ✅ Einzige erlaubte Änderung an Core: +1 Zeile Import + 1 Zeile `include_router` in `server.py`, +1 Menüpunkt in `Navigation.jsx`, +1–2 Routes in `App.js`

---

## 🔒 PORTAL V2 IST TABU

Das Kundenportal v2 ist **FERTIG und LIVE**. **Keine Änderung** an:
- ❌ `/app/backend/portal_v2/` (kompletter Ordner)
- ❌ `/app/frontend/src/pages/portal_v2/` (kompletter Ordner)
- ❌ Collections `portal2_*`
- ❌ Route `/api/portal-v2/*`

**User-Zitat 23.04.2026:** *„wir werden nicht am portal v2 arbeiten es seid ich gebe die direkte und präzise erlaubniss"*

---

## 🏗️ Architektur

- **Frontend:** React + Tailwind + Shadcn/ui
- **Backend:** FastAPI
- **DB:** MongoDB (`graupner_suite`)
- **Storage:** Emergent Object Storage (`utils/storage.py`)
- **Auth:** JWT (Suite-Nutzer) + separater JWT für Portal-v2-Kunden
- **Email:** SMTP (service24@tischlerei-graupner.de, IONOS)

---

## 📦 Module

### Core-Module (stabil, minimale Änderungen)
- `routes/auth.py`, `routes/module_kunden.py`, `routes/module_artikel.py`, `routes/module_dokumente.py`, `routes/module_textvorlagen.py`, `routes/modules.py`, `routes/einsaetze.py`, `routes/mitarbeiter.py`, `routes/webhook.py`, `routes/anfragen.py`, `routes/portal.py` (altes Portal – bleibt)

### Isolierte Module (Module-First)
- `routes/rechnungen_v2.py` — Collection `rechnungen_v2` (Sandbox)
- **`portal_v2/`** — Kundenportal v2 (LIVE, TABU)
- `portal_v3/` — Performance-Sandbox (Thumbnails, Multi-Upload)
- **`dokumente_v2/`** — NEU (23.04.2026, s. unten)

### Frontend-Helper-Seiten
- `pages/handy_zugang/HandyZugangPage.jsx` — QR-Code für Mobile-Login
- `pages/wissen/WissenPage.jsx` — GoBD-Tipps / interne Familien-Notizen

---

## ✅ Dokumente v2 (fertig Phase 1-3, 23.04.2026)

**Pfad Backend:** `/app/backend/dokumente_v2/`
**Pfad Frontend:** `/app/frontend/src/pages/dokumente_v2/`
**API-Prefix:** `/api/dokumente-v2/*`
**Feature-Flag:** `dokumente_v2_settings.feature_enabled`
**Menü:** „Dokumente v2 (Neu)" (`/dokumente-v2`)

### Phasen-Status
- ✅ **Phase 1** – Gerüst, CRUD, GoBD-Nummerngenerator (atomic `$inc`, Audit-Log, Lücken-Check)
- ✅ **Phase 2** – Editor-MVP (Positionen, Kundenlookup, Totals-Recalc Server-Side, §35a-Lohnanteil)
- ✅ **Phase 3** – PDF-Generator (eigener ReportLab, isoliert – KEIN Zugriff auf `utils/pdf.py`)
- 🟡 **Phase 4** – State-Machine (TODO): Angebot → Auftragsbestätigung → Rechnung per Klick
- 🟡 **Phase 5** – OPTIONAL nur mit expliziter User-Erlaubnis: Portal-v2-Anbindung (neue Datei `portal_v2/documents.py`, lesend auf `dokumente_v2`)

### Collections (vollständig isoliert)
- `dokumente_v2` (Dokumente)
- `dokumente_v2_counters` (Nummernzähler)
- `dokumente_v2_counter_log` (GoBD-Audit)
- `dokumente_v2_settings`

### GoBD-Features
- Rechnungen + Gutschriften sind `STRICT_TYPES`: nach `issue` unveränderbar, nicht löschbar (nur storniert)
- Monatlicher Reset der Nummernkreise (Format: `RE-2026-04-0001`)
- Audit-Log jeder Nummernvergabe
- Lücken-Check-Endpoint
- §35a-EStG-Hinweis auf Rechnungen mit Lohnanteil

### Isolation verifiziert (28/28 Pytest grün)
- Keine Schreibzugriffe auf `quotes`, `orders`, `invoices`, `module_kunden`, `settings`
- Nur lesend: `settings.company_settings` (für PDF-Header), `module_kunden` (für Kundenlookup)

### Regressions-Testdatei
- `/app/backend/tests/test_dokumente_v2_phase23.py`

---

## ✅ Kundenportal v2 (LIVE, TABU seit 22.04.)

Siehe alter PRD-Stand. Phase 1–5 komplett, live deployed.

---

## 📋 Aktuelle Prioritäten / Backlog

### P0 (jetzt dran)
- **Dokumente v2 Phase 4** – State-Machine Angebot → Auftragsbestätigung → Rechnung

### P1
- Dokumente v2 Phase 5 (optional) – Portal-v2-Anbindung (nur mit expliziter User-Erlaubnis)
- Chrome Push-Notifications „Wiedervorlage"-Spam abschalten (Feature-Flag)

### P2
- Portal v3 → v2 Performance-Migration (Thumbnails, Cache) – nur auf Wunsch
- Stundenplan-Kontrolle (BLOCKED: PDF-Beispiel vom User fehlt)
- Automatische Kundennummern (`G210426/0625`)
- SEO/Ranking-Modul, DATEV-Export, Monteur-PWA

---

## 🔑 Wichtige Hinweise für neue Agenten

1. **Sprache:** ALLE Antworten auf DEUTSCH.
2. **Live vs Preview:** User arbeitet LIVE. DBs getrennt. Nach Features: „Save to GitHub + Re-Deploy"-Hinweis.
3. **E-Mail:** Betterbird wird extern genutzt — kein Hintergrund-IMAP-Polling!
4. **Kontaktdaten-Quelle:** `module_kunden` (NICHT `anfragen` oder `module_kontakt`).
5. **User arbeitet NICHT produktiv mit Graupner Suite**, er nutzt **Baufaktura + Betterbird** — daher keine Datenmigration nötig, Dokumente v2 kann frei getestet werden.
6. **Erst ask_human, dann code:** Vor jeder Feature-Implementierung `ask_human` mit Plan.
7. **Credits respektieren:** User hat 1000 € bereits durch Module-First-Verletzungen verloren. Kein unbestelltes Refactoring.

---

## 📝 Changelog

### 22.04.2026 – Portal v2 MVP
- Portal v2 Phase 1-5 (Gerüst, Import, Auth, Chat, Uploads)
- Portal v3 Sandbox (Thumbnails, Multi-Upload)
- Handy-Zugang Seite, Wissen & Tipps Seite

### 23.04.2026 – Dokumente v2 Phase 1-3
- Backend-Gerüst mit isolierten Collections + Feature-Flag
- GoBD-konformer Nummerngenerator (atomic $inc, Audit-Log, Lücken-Check)
- Editor-MVP Frontend mit Positionen, Kundenlookup, Totals-Berechnung
- Eigener PDF-Generator (ReportLab, isoliert)
- GoBD-Schutz: Rechnungen/Gutschriften nach Issue unveränderbar, nur stornierbar
- 28/28 Pytest grün
- Regressions-Testdatei `/app/backend/tests/test_dokumente_v2_phase23.py`
- Lint: clean, Minor-Fix für PUT auf stornierte Strict-Dokumente (409)
