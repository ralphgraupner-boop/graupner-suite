# Graupner Suite – Product Requirements (PRD)

**Projekt:** Graupner Suite – Handwerker-Verwaltungssoftware für Tischlerei R.Graupner
**Prinzip:** **Module-First — jedes Modul ist eigenständig, eigene Routes + Collections + Feature-Flag.**
**Live:** https://code-import-flow-1.emergent.host
**Preview:** https://handwerk-deploy.preview.emergentagent.com
**Sprache:** Antworten **NUR auf Deutsch**.

---

## 🚦 Stand: 26.04.2026 Nacht

- Portal v2: LIVE, TABU
- Dokumente v2 Phase 1+2+3+4: ✅ komplett (49/49 Tests grün)
- `/portals` Bugs aufgeräumt (Sidebar, Aktiv-Toggle, Textvorlagen sichtbar, Script-Error gefixt)
- DB ist absichtlich leer/wenige Datensätze – User testet live
- **Nächste Priorität:** Module-First Workflow für `module_aufgaben` → `module_termine` → Google-Kalender-Anbindung

---

## 🚨 ABSOLUTE REGEL (Module-First)

### Korrekt
- ✅ Neuer Ordner `/app/backend/<modulname>/` mit eigenem Router, eigenen Collections (`module_*`)
- ✅ Eigenes API-Prefix
- ✅ Feature-Flag in eigener Settings-Collection
- ✅ Einzige Core-Änderungen erlaubt: +1 `include_router` in `server.py`, +1 Menüpunkt in `Navigation.jsx`, +1–2 Routes in `App.js`

### Datenmasken-Prinzip (VOM USER VORGEGEBEN)
> "Datenmasken bedienen sich aus den jeweiligen zuständigen Modulen, welche Daten zur Verfügung stellen."

- Datenmasken **referenzieren nur per ID** (`kunde_id`, `projekt_id`, `termin_id`)
- Kein Daten-Kopieren zwischen Modulen (Ausnahme: Anfragen-Bilder → Projekt einmalig beim Erstellen)
- Composite-Views (z.B. Werkbank, Monteur-Detail) joinen lesend aus mehreren Modulen

### Verboten
- ❌ Änderungen an `utils/__init__.py` (SMTP-Kern), `WysiwygDocumentEditor.jsx`, `routes/portal.py` Logik, `routes/webhook.py`, `DashboardPage.jsx`
- ❌ Mass-DB-Schreiben ohne explizite Schritt-für-Schritt-User-Zustimmung
- ❌ Mock-Daten in den Live-Collections

---

## 🔒 PORTAL V2 IST TABU
Komplettes Sub-System `/app/backend/portal_v2/`, `/app/frontend/src/pages/portal_v2/`, Collections `portal2_*`, Route `/api/portal-v2/*` — keine Änderungen.

---

## 📦 Modul-Übersicht

| Modul | Zweck | Status |
|---|---|---|
| `module_kunden` | Stammdaten Kunde | ✅ |
| `module_projekte` | Kundenprojekte (Datenmaske Werkbank) | ✅ |
| `module_duplikate` | Duplikat-Erkennung & Merge | ✅ |
| `module_textvorlagen` | Textbausteine (`doc_type` getypt) | ✅ |
| `dokumente_v2` | GoBD-Dokumente Phase 1-4 | ✅ |
| `monteur_app` | Datenmaske: Einsatz + Kunde, schreibt Notizen/Fotos/Todos/Feedback | ✅ Basis, **erweiterbar** |
| `module_portal_v2_backup` | Snapshots der Portal-Tabellen | ✅ |
| `portal_klon` | 1:1 Sandbox-Kopie von `/portals` | ✅ |
| `portals` (legacy) | Aktiv genutztes Kundenportal | ✅ (User-Präferenz) |
| `einsaetze` | Kern-Einsatzmodul (Termine als Felder) | ✅ |
| **`module_aufgaben`** | Interne Aufgaben (Auto waschen, Werkzeugpflege) | ❌ **TODO** |
| **`module_arbeitsanweisungen`** | Ausführungstexte/Arbeitsanweisungen | ❌ TODO (oder über Textvorlagen) |
| **`module_termine`** | Termine isoliert mit Status-Workflow | ❌ **TODO** |
| **`module_google_kalender`** | API-Sync mit Bestätigungs-Dialog ("GO") | ❌ **TODO** |

---

## 🎯 Roadmap (Priorität)

### P0 – Nächste Iterationen (User-vorgegebene Reihenfolge: b → a → c)
1. **`module_aufgaben`** (interne Aufgaben) — Klärung offen: gemeinsame Liste mit Tag oder eigener Tab?
2. **`module_termine`** — eigenes Modul mit Status `wartet_auf_go` / `bestaetigt` / `im_kalender`
3. **Google-Kalender-Anbindung** — manueller "GO"-Klick mit Bestätigungs-Dialog

### P1 – Portal-Bugs (heute Nacht, 26.04.2026)
- ✅ Sidebar aufgeräumt: nur `/portals` + `/portals-klon` sichtbar
- ✅ Toggle-Button "Aktiv/Inaktiv" mit grün/grau Farben (Card + Detail)
- ✅ Textvorlagen jetzt sofort sichtbar (10 Vorlagen `doc_type=kundenportal` in DB)
- ✅ Script-Error im Portal-Detail (500 → 404 + axios validateStatus) gefixt
- ⏳ **Bug #1 (Import-Filter)** — muss morgen live mit User reproduziert werden, aktuell kein "Inaktiv"-Status in DB

### P2 – Backlog
- Admin-Übersicht Monteur-Tagesdoku
- Mobile Bildkompression im Monteur-App
- Dashboard Anfragen-Counter (21 vs 10) – Live-Reproduktion nötig

### P3 – Future
- Stundenplan-Kontrolle (Monthly Timesheet) — User liefert PDF-Beispiel
- DATEV-Export
- Re-Evaluierung ob `einsaetze` durch neue Modul-Architektur ersetzbar

---

## 📁 Wichtige Code-Pfade

### Backend
- `/app/backend/server.py` — Router-Includes
- `/app/backend/monteur_app/routes.py` — Datenmasken-Beispiel (liest aus `einsaetze` + `module_kunden`)
- `/app/backend/module_projekte/` — Werkbank-Datenmaske
- `/app/backend/routes/portal.py` — Legacy Portal (CARE)
- `/app/backend/routes/portal_klon.py` — Sandbox

### Frontend
- `/app/frontend/src/components/layout/Navigation.jsx` — Sidebar (Portal-Items aufgeräumt)
- `/app/frontend/src/pages/PortalsPage.jsx` — Legacy Portal mit Toggle + Textvorlagen-Liste
- `/app/frontend/src/pages/monteur_app/MonteurAppPage.jsx`
- `/app/frontend/src/pages/monteur_app/MonteurEinsatzDetailPage.jsx`

---

## 🔑 Test-Credentials
Admin: `admin` / `Graupner!Suite2026` (siehe `/app/memory/test_credentials.md`)

---

## 🗂 Datenmaske Monteur-App (aktuell)
```
GET /api/monteur/einsaetze/{id}
   ├─ einsatz       ← einsaetze
   ├─ kunde_detail  ← module_kunden (per customer_id)   ← Datenmaske
   ├─ monteur_notizen / _fotos / _todos / _feedback     ← isolierte Collections
```

**Ziel-Erweiterung (nach b/a/c):**
```
   + projekt_detail   ← module_projekte (per projekt_id)
   + termin_detail    ← module_termine  (per termin_id)
   + aufgaben_detail  ← module_aufgaben (interne Aufgaben)
```
