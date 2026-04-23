# Graupner Suite – Product Requirements (PRD)

**Projekt:** Graupner Suite – Handwerker-Verwaltungssoftware für die Tischlerei R.Graupner
**Prinzip:** **Modulare Architektur — jedes Modul ist eigenständig (Module-First).**
**Live-URL:** https://code-import-flow-1.emergent.host
**Preview-URL:** https://handwerk-deploy.preview.emergentagent.com

---

## 🚦 BRIEFING FÜR DEN NÄCHSTEN AGENTEN

### 🛑 SOFORT-ANWEISUNGEN
1. **Sprache: NUR DEUTSCH.**
2. **Portal v2 ist TABU** (siehe unten). Dokumente v2 nur mit Plan anfassen.
3. **Start der Session:** `ask_human` mit Plan und Bestätigung bevor du loslegst.
4. **Module-First-Regel einhalten** — keine Änderungen an Core-Dateien ohne Bitte.

### 📅 Stand: 23.04.2026 Mittag

- Portal v2: LIVE, TABU
- **Dokumente v2 Phase 1+2+3+4: ✅ komplett getestet** (49/49 Pytest grün), Navigation + UX-Polish abgeschlossen
- State-Machine: Angebot→Auftrag→Rechnung→Gutschrift per Klick, Vorgänger/Nachfolger-Verlinkung sichtbar
- Nächster Step: Deploy durch User, dann entweder Phase 5 (Portal-Anbindung, optional) oder andere Prioritäten

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
- **Auth:** JWT (Suite-Admin) + separater JWT für Portal-v2-Kunden
- **Email:** SMTP (service24@tischlerei-graupner.de, IONOS)

---

## 📦 Module

### Core-Module (stabil)
`routes/auth.py`, `routes/module_kunden.py`, `routes/module_artikel.py`, `routes/module_dokumente.py` (LEGACY), `routes/module_textvorlagen.py`, `routes/modules.py`, `routes/einsaetze.py`, `routes/mitarbeiter.py`, `routes/webhook.py`, `routes/anfragen.py`, `routes/portal.py` (altes Portal)

### Isolierte Module (Module-First)
- `routes/rechnungen_v2.py` — Sandbox
- **`portal_v2/`** — Kundenportal v2 (LIVE, TABU)
- `portal_v3/` — Portal-Sandbox
- **`dokumente_v2/`** — NEU (23.04.2026), Phase 1-4 komplett

### Sidebar visuell (23.04.2026)
- **NEU (grün, fette Border, NEU-Badge):** Dokumente (v2), Kundenportal (v2)
- **ALT (ausgegraut, kursiv, durchgestrichen, ALT-Badge):** Dokumente (alt), Kundenportale (alt)
- **TEST (amber, gestrichelt, TEST-Badge):** Kundenportal (Test) = v3-Sandbox

---

## ✅ Dokumente v2 (Phase 1-4 fertig, 23.04.2026)

**Pfad Backend:** `/app/backend/dokumente_v2/`
**Pfad Frontend:** `/app/frontend/src/pages/dokumente_v2/`
**API-Prefix:** `/api/dokumente-v2/*`
**Feature-Flag:** `dokumente_v2_settings.feature_enabled`

### Phasen
- ✅ **Phase 1** – Gerüst, CRUD, GoBD-Nummerngenerator (atomic `$inc`, Audit-Log, Lücken-Check)
- ✅ **Phase 2** – Editor-MVP (Positionen, Kundenlookup, Totals, §35a-Lohnanteil)
- ✅ **Phase 3** – PDF-Generator (eigener ReportLab, isoliert)
- ✅ **Phase 4** – State-Machine: Convert-Endpoint + Chain-Endpoint
  - Erlaubt: angebot→auftrag, angebot→rechnung, auftrag→rechnung, rechnung→gutschrift
  - Positionen werden kopiert (mit neuen UUIDs), Kundendaten übernommen, parent_id gesetzt
  - Frontend: „Umwandeln in…"-Dropdown + Vorgänger/Nachfolger-Badges im Editor
- ✅ **UX-Polish** – Neu-Dialog Kunden-Autocomplete aus `module_kunden`, Auto-Fill
- 🟡 **Phase 5** (OPTIONAL, nur mit User-OK) – Portal-v2-Anbindung

### Collections
`dokumente_v2`, `dokumente_v2_counters`, `dokumente_v2_counter_log`, `dokumente_v2_settings`

### GoBD
- Rechnungen + Gutschriften = STRICT_TYPES: nach Issue unveränderbar, nicht löschbar, nur stornierbar
- Stornierte Dokumente: weder editierbar noch konvertierbar
- Monatlicher Reset (Format: `RE-2026-04-0001`)
- §35a-EStG-Hinweis auf Rechnungen mit Lohnanteil

### Test-Abdeckung: 49/49 pytest grün
- `/app/backend/tests/test_dokumente_v2_phase23.py` (28 Tests)
- `/app/backend/tests/test_dokumente_v2_phase4.py` (21 Tests)

---

## 📋 Prioritäten

### P0 (offen)
- **Push to GitHub + Re-Deploy** (durch User) damit Phase 4 + UI-Polish live gehen

### P1
- Phase 5 (optional): Portal-v2-Anbindung (nur mit expliziter User-Erlaubnis)
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
6. Credits respektieren.

---

## 📝 Changelog

### 22.04.2026 – Portal v2 MVP
Portal v2 Phase 1-5 (Gerüst, Import, Auth, Chat, Uploads), Portal v3 Sandbox, Handy-Zugang, Wissen & Tipps

### 23.04.2026 – Dokumente v2 + UI-Polish + State-Machine
- Phase 1+2+3+4 komplett, **49/49 Pytest grün**
- Minor GoBD: PUT auf stornierte Strict-Dokumente → 409
- Neu-Dialog: Kunden-Picker mit Autocomplete, Auto-Fill (Adresse, Email)
- Navigation: v2-Module grün hervorgehoben, ALT-Module ausgegraut, TEST-Module amber
- State-Machine: `POST /convert` + `GET /chain`, „Umwandeln in…"-Dropdown, Vorgänger/Nachfolger-Badges
