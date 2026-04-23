# Graupner Suite – Product Requirements (PRD)

**Projekt:** Graupner Suite – Handwerker-Verwaltungssoftware für die Tischlerei R.Graupner
**Prinzip:** **Modulare Architektur — jedes Modul ist eigenständig (Module-First).**
**Live-URL:** https://code-import-flow-1.emergent.host
**Preview-URL:** https://handwerk-deploy.preview.emergentagent.com

---

## 🚦 BRIEFING FÜR DEN NÄCHSTEN AGENTEN

### 🛑 SOFORT-ANWEISUNGEN
1. **Sprache: NUR DEUTSCH.**
2. **Portal v2 ist TABU** (siehe unten). Dokumente v2 ebenfalls nur mit Plan anfassen.
3. **Start der Session:** `ask_human` mit Plan und Bestätigung bevor du loslegst.
4. **Module-First-Regel einhalten** — keine Änderungen an Core-Dateien ohne Bitte.

### 📅 Stand: 23.04.2026 Morgen

- Portal v2: LIVE, tabu
- Dokumente v2 Phase 1+2+3: ✅ **komplett getestet** (28/28 Pytest grün, Frontend smoke OK), LIVE deployed
- Navigation: v2-Module visuell grün hervorgehoben, Legacy-Module (Dokumente/Kundenportale) ausgegraut mit „ALT"-Badge
- Dokumente v2 Neu-Dialog: Kunden-Auswahl aus `module_kunden` mit Autocomplete + auto-Fill (Adresse, E-Mail)

---

## 🚨 ABSOLUTE REGEL (Module-First)

**Jedes neue Feature MUSS in einem eigenen, isolierten Ordner/Modul entstehen — mit eigenen Collections und Feature-Flag.**

### Konkret verboten
- ❌ Änderungen an `utils/__init__.py` (SMTP-Kern) für neue Features
- ❌ Bearbeitung von `WysiwygDocumentEditor.jsx` (>1200 Zeilen, Core)
- ❌ Neue Logik in `routes/portal.py`, `routes/webhook.py`, `DashboardPage.jsx`

### Korrekt
- ✅ Neuer Ordner `/app/backend/<modulname>/` mit `__init__.py`, eigenen Routes, Models
- ✅ Eigene MongoDB-Collections mit Prefix (`portal2_*`, `dokumente_v2_*`, …)
- ✅ Eigenes API-Prefix (`/api/portal-v2/*`, `/api/dokumente-v2/*`, …)
- ✅ Feature-Flag in eigener Settings-Collection
- ✅ Einzige Core-Änderungen: +1 include_router in `server.py`, +1 Menüpunkt in `Navigation.jsx`, +1–2 Routes in `App.js`

---

## 🔒 PORTAL V2 IST TABU

- ❌ `/app/backend/portal_v2/` (komplett)
- ❌ `/app/frontend/src/pages/portal_v2/` (komplett)
- ❌ Collections `portal2_*`
- ❌ Route `/api/portal-v2/*`

**User-Zitat 23.04.2026:** *„wir werden nicht am portal v2 arbeiten es seid ich gebe die direkte und präzise erlaubniss"*

---

## 🏗️ Architektur

- **Frontend:** React + Tailwind + Shadcn/ui
- **Backend:** FastAPI
- **DB:** MongoDB (`graupner_suite`)
- **Storage:** Emergent Object Storage
- **Auth:** JWT (Suite-Admin) + separater JWT für Portal-v2-Kunden
- **Email:** SMTP (service24@tischlerei-graupner.de, IONOS)

---

## 📦 Module

### Core-Module (stabil)
- `routes/auth.py`, `routes/module_kunden.py`, `routes/module_artikel.py`, `routes/module_dokumente.py` (LEGACY, wird ersetzt), `routes/module_textvorlagen.py`, `routes/modules.py`, `routes/einsaetze.py`, `routes/mitarbeiter.py`, `routes/webhook.py`, `routes/anfragen.py`, `routes/portal.py` (altes Portal)

### Isolierte Module (Module-First)
- `routes/rechnungen_v2.py` — `/api/v2/*`, Collection `rechnungen_v2`
- **`portal_v2/`** — Kundenportal v2 (LIVE, TABU)
- `portal_v3/` — Portal-Sandbox (Thumbnails, Multi-Upload)
- **`dokumente_v2/`** — NEU (23.04.2026), s. unten

### Frontend-Helper-Seiten
- `pages/handy_zugang/HandyZugangPage.jsx`
- `pages/wissen/WissenPage.jsx`

### Sidebar visuell (23.04.2026)
- **NEU-Badge (grün hervorgehoben):** Dokumente (v2), Kundenportal (v2)
- **ALT-Badge (ausgegraut, durchgestrichen):** Dokumente (alt), Kundenportale (alt)
- **TEST-Badge (amber, gestrichelt):** Kundenportal (Test) = v3-Sandbox

---

## ✅ Dokumente v2 (Phase 1-3 fertig, 23.04.2026)

**Pfad Backend:** `/app/backend/dokumente_v2/`
**Pfad Frontend:** `/app/frontend/src/pages/dokumente_v2/`
**API-Prefix:** `/api/dokumente-v2/*`
**Feature-Flag:** `dokumente_v2_settings.feature_enabled`

### Phasen
- ✅ **Phase 1** – Gerüst, CRUD, GoBD-Nummerngenerator (atomic `$inc`, Audit-Log, Lücken-Check)
- ✅ **Phase 2** – Editor-MVP (Positionen, Kundenlookup, Totals-Recalc server-side, §35a-Lohnanteil)
- ✅ **Phase 3** – PDF-Generator (eigener ReportLab, isoliert – KEIN Zugriff auf `utils/pdf.py`)
- ✅ **UX-Verfeinerung (23.04.)** – Neu-Dialog: Kunden-Picker mit Live-Autocomplete aus `module_kunden`, Auto-Fill (Adresse, Email)
- 🟡 **Phase 4** (TODO) – State-Machine Angebot → Auftragsbestätigung → Rechnung
- 🟡 **Phase 5** (OPTIONAL, nur mit User-OK) – Portal-v2-Anbindung

### Collections
`dokumente_v2`, `dokumente_v2_counters`, `dokumente_v2_counter_log`, `dokumente_v2_settings`

### GoBD
- Rechnungen + Gutschriften = STRICT_TYPES: nach Issue unveränderbar, nicht löschbar (nur stornierbar)
- Monatlicher Reset (Format: `RE-2026-04-0001`)
- Audit-Log jeder Nummernvergabe
- §35a-EStG-Hinweis auf Rechnungen mit Lohnanteil

### Isolation verifiziert (28/28 Pytest grün)
- Keine Schreibzugriffe auf `quotes`, `orders`, `invoices`, `module_kunden`, `settings`
- Nur lesend: `settings.company_settings`, `module_kunden`

### Test-Datei
`/app/backend/tests/test_dokumente_v2_phase23.py`

---

## 📋 Prioritäten

### P0
- Dokumente v2 **Phase 4** – State-Machine (Angebot → AB → Rechnung per Klick, `parent_id`, Positionen-Copy)

### P1
- Dokumente v2 Phase 5 (optional, nur mit User-OK)
- Push-Notification „Wiedervorlage"-Spam-Flag

### P2
- Portal v3 → v2 Performance-Migration (Thumbnails, Cache)
- Stundenplan-Kontrolle (BLOCKED: PDF-Beispiel fehlt)
- Auto-Kundennummern, SEO, DATEV, PWA

---

## 🔑 Hinweise

1. Sprache: DEUTSCH.
2. **User arbeitet NICHT produktiv mit Graupner Suite** (nutzt Baufaktura + Betterbird) — freie Test-Spielwiese.
3. E-Mail: Betterbird extern → kein IMAP-Polling!
4. Kontaktdaten-Quelle: `module_kunden`.
5. Vor Feature: `ask_human` mit Plan.
6. Credits respektieren: User hat 1000 € durch Module-First-Verletzungen verloren.

---

## 📝 Changelog

### 22.04.2026 – Portal v2 MVP
- Portal v2 Phase 1-5 (Gerüst, Import, Auth, Chat, Uploads)
- Portal v3 Sandbox (Thumbnails, Multi-Upload)
- Handy-Zugang, Wissen & Tipps

### 23.04.2026 – Dokumente v2 + UI-Polish
- Dokumente v2 Phase 1+2+3 komplett, 28/28 Pytest grün
- Minor GoBD: PUT auf stornierte Strict-Dokumente → 409
- Neu-Dialog: Kunden-Picker mit Autocomplete aus `module_kunden`, Auto-Fill
- Navigation: v2-Module grün hervorgehoben, ALT-Module ausgegraut, TEST-Module amber
