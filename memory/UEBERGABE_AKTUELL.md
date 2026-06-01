# 📋 ÜBERGABE FÜR DEN NÄCHSTEN AGENTEN
## (Emergent ODER Claude — gilt für beide)

**Stand:** 01.06.2026, ca. 19:00 Hamburger Zeit
**Auftraggeber:** Ralph Graupner, Tischlerei Graupner
**Projekt:** Graupner Suite (modulares Tischlerei-CRM, Beta-Phase)
**Datei:** `/app/memory/UEBERGABE_AKTUELL.md` (immer aktuell halten)

---

## 🛑 PFLICHT — IN DEINER ERSTEN ANTWORT MUSST DU

1. Alle **13 Regeln einzeln nennen** (siehe unten — wörtlich, nicht paraphrasieren)
2. Den **Schlusssatz wörtlich wiederholen**
3. **Letzten Commit nennen** (per `git log --oneline -1`)
4. **Hamburger Zeit angeben** (per `TZ='Europe/Berlin' date`)
5. Mir 3 priorisierte Optionen für heute vorschlagen
6. Auf mein „Ja" + Buchstabe warten — **KEIN CODE vorher**

Wenn du eine dieser 6 Pflichten überspringst, sage ich „Stopp" — und du musst neu anfangen.

---

## 📜 DIE 13 REGELN (alle gleich wichtig)

1. **Plan vor Code** — kein Code ohne ausdrückliches „Ja" von Ralph.
2. **Nur Ralph Graupner** autorisiert Änderungen.
3. **Nur Deutsch**, einfache Sprache, **KEINE Werbung, KEIN Upselling**.
4. **Module-First** — keine Datendopplung, keine hardcoded Listen, neue Features in `module_X`.
5. **Nie auf Live ohne Freigabe** — DB-Snapshot vor jeder Migration Pflicht.
6. **Bei Bugs IMMER klären:** Preview oder Live?
7. **Direkt umsetzen**, wenn Ralph explizit anweist — dann ohne Plan.
8. **Datei ansehen** vor jedem Edit.
9. **Effizient & zukunftsorientiert** — max. 15–20 Credits pro Task.
10. **Vorher prüfen**, ob ein ähnliches Modul/Funktion/Feld bereits existiert.
11. **Deploy-Historie** jeden Morgen in Hamburger Zeit prüfen.
12. **„Ich weiß es nicht"** ist besser als eine falsche Antwort.
13. **Vor JEDER Änderung IMMER zuerst prüfen**, ob ein Modul, eine Funktion oder ein Datenfeld bereits existiert. Keine Ausnahme. *(Neu seit 01.06.2026 — wurde nötig, weil ein Agent eine Username-Liste hardgecodet hat, obwohl die Daten in `db.users` bereits standen.)*

### Schlusssatz (genau so wiederholen)

> *„Ich habe alle 13 Regeln einzeln gelesen und bestätige ihre vollständige Einhaltung. Ich programmiere NICHTS ohne Ralphs ausdrückliches Ja. Kein Code ohne Plan. Kein Deploy ohne Freigabe. Kein neues Modul ohne Prüfung, ob etwas Ähnliches bereits existiert. Alle Zeitangaben mache ich in Hamburger Zeit. Ich arbeite effizient und zukunftsorientiert. Sprachsteuerung wird bei jeder neuen Funktion mitgedacht."*

---

## ⛔ WAS DU NIE OHNE EINVERSTÄNDNIS DARFST

- ❌ Code schreiben/ändern, bevor Ralph „Ja" + Buchstabe gesagt hat
- ❌ Werbung machen, paid plans erwähnen, Floskeln verwenden
- ❌ Live-System anfassen (`code-import-flow-1.emergent.host` o.ä.)
- ❌ DB-Migrationen ohne Snapshot
- ❌ Neue Module bauen, ohne zu prüfen ob etwas Ähnliches existiert (Regel 13)
- ❌ Hardcoded Listen, Namen, E-Mails im Code (Regel 4)
- ❌ Auf Englisch antworten
- ❌ „Ich glaube schon" sagen — Regel 12 verlangt Ehrlichkeit
- ❌ Live-Deploy auslösen (das macht nur Ralph über die Emergent UI)
- ❌ Git-Push (das macht Ralph über „Save to Github"-Knopf)
- ❌ Bezahlte Emergent-Features anpreisen
- ❌ Dem Tagesplan eines anderen Agenten widersprechen, ohne ihn zu prüfen

---

## ✅ WAS DU SOFORT TUN DARFST (ohne Rückfrage)

- ✅ Code lesen, Logs lesen, DB-Inhalte lesen
- ✅ Pytest ausführen
- ✅ Curl-Befehle ausführen
- ✅ Plan vorlegen, Optionen erläutern
- ✅ „Ich weiß es nicht" sagen, wenn du es nicht weißt
- ✅ Stopp sagen, wenn du eine Regelverletzung erkennst

---

## 🏗️ ARCHITEKTUR-KURZBLICK

- **Frontend:** React + Tailwind, in `/app/frontend/src/`
- **Backend:** FastAPI + MongoDB, in `/app/backend/`
- **Modulstruktur:** Jedes Feature in `/app/backend/module_X/` mit eigener `routes.py`
- **Alt-Lasten:** `/app/backend/routes/` (alte Struktur, wird schrittweise nach `module_X/` migriert)
- **Frontend-Eingang:** `frontend/src/App.js`
- **Memory/Docs:** `/app/memory/`

---

## 🎯 STAND (01.06.2026 Abend) — HEUTE FERTIG GEMACHT

1. **Datensicherheit** — Pydantic `exclude_unset=True` in 3 Modulen (Rechnungen v2, Kunden legacy, Services). Pytest 3/3 grün.
2. **KI-Assistent MVP** in `module_assistent` (Voice-to-Action). 4 Tools: `aufgabe_anlegen`, `termin_anlegen`, `kunde_suchen`, `notiz_schreiben`. Persönliche Ansprache an Ralph. ICS-Mail an `monteur_username` aus `db.users`. Frontend: `KiChatPanel.jsx`. Tests 6/7 grün.
3. **Hardcode raus** aus `ai_tools.py` (Empfänger kommt jetzt aus DB) + **Berechtigungs-Türsteher** via `check_berechtigung()` vor jedem Tool.
4. **KI-Direkt-Link** nach jeder Aktion (Knopf „➜ Aufgabe öffnen" usw.).
5. **KI-Per-Session-Budget** auf 2 USD erhöht (über `with_params(max_budget=2.0)` und frischer Session-Hash pro `/ask`).
6. **Backup-System Stufen 1+2+4:**
   - Empfänger aus `db.settings.auto_backup_settings` (kein Hardcode)
   - 3 Speicherziele: E-Mail + lokal `/app/backups/` + Object-Storage
   - Restore-System mit Trockenlauf + Pre-Restore-Sicherung
   - Dashboard-Karte `BackupStatusCard.jsx` mit Ampel
   - Pytest 8/8 grün
7. **Regel 13 eingeführt**, in `AGENT_BRIEFING.md` aktualisiert.
8. **Backup vor Eingriff erstellt:** `/app/memory/backups/preview_backup_20260601_1639.zip`

**Gesamttest:** 18/18 Pytest grün.

---

## 🌅 MORGENPLAN — WAS RALPH ABARBEITEN WILL

### Vor allem anderen prüfen
1. **Letzten Commit ansehen** (`git log --oneline -1`)
2. **Backup-Log prüfen:** Lief der Auto-Backup-Task um 02:00 UTC? In `db.auto_backup_log` nachschauen oder per Dashboard-Karte. **Wenn der Lauf rot ist:** dringend reparieren.
3. **Deploy-Historie prüfen** (Regel 11) — was wurde gestern auf Live deployed?
4. **Hamburger Zeit melden**

### Offene Punkte mit Priorität

#### 🔴 P0 (heute angehen)
- **Auto-Backup-Scheduler verifizieren:** Wenn 02:00-UTC-Lauf gestern Nacht NICHT ausgelöst hat → Architektur reparieren (echter Cron-Job statt `asyncio.sleep`).
- **`module_personal` Strangler-Migration** — Plan liegt unter `/app/memory/SCHLACHTPLAN_module_personal.md`. Ralph hat zugestimmt, Strangler statt Krücke. 4 Entscheidungsfragen am Ende des Plans erst klären, dann bauen.

#### 🟠 P1 (diese Woche)
- **Frontend für Backup-Settings** (E-Mail-Empfänger-Verwaltung) — momentan nur API.
- **Backup-Verlaufsliste** auf der Dashboard-Karte (letzte 7 Backups als kleine Tabelle).
- **`projekt_id` persistent** in Angebot/Auftrag/Rechnung speichern.
- **Navigation „← Zurück zu Werkbank/Kunde"** mit `?returnTo=…` Pattern.
- **Backend Pytest-Suite** reparieren (19 alte Tests mit veralteten Credentials).

#### 🟡 P2 (Backlog)
- Public Contact API Phase 1 (Jimdo) als `module_public_api`
- Echter Google-Calendar-API-Sync als `module_google_calendar` (statt heute ICS-Mail)
- KI Phase 2: Suggestions (passende Vorlagen vorschlagen)
- KI Phase 3: Memory/RAG über frühere Konversationen
- 12 kaputte Umlaute in `module_textvorlagen` (Live-DB, nur nach Snapshot)
- FritzBox Call-Monitor-Sync
- N26 CSV-Import + Buchhaltung

---

## 🔑 ZUGRIFFSDATEN (Preview)

- **Admin-Login (Preview):** `admin-preview` / `HamburgPreview2026!`
- **Backend-URL:** in `frontend/.env` als `REACT_APP_BACKEND_URL`
- **MongoDB:** lokal via `MONGO_URL` in `backend/.env` — NIEMALS verändern
- **LLM-Key:** Über `EMERGENT_LLM_KEY` env, läuft via `emergentintegrations`-Library
- **Live-System:** `code-import-flow-1.emergent.host` — **NICHT anfassen ohne Ralphs Ja**

---

## 📂 WICHTIGE DATEIEN ZUM LESEN (in dieser Reihenfolge)

1. `/app/memory/UEBERGABE_AKTUELL.md` (diese Datei)
2. `/app/memory/AGENT_BRIEFING.md` (mit Regel 13 erweitert)
3. `/app/memory/PRD.md` (Produkt-Anforderungen, alle Änderungen mit Datum)
4. `/app/memory/SCHLACHTPLAN_module_personal.md` (Strangler-Plan für die nächste größere Migration)
5. `/app/memory/MORGENS_VORLAGE.md` (Vorlage, falls neuer Agent)

---

## 🛡️ NOTFALL

Falls etwas schiefläuft:
- **Backup vom 01.06.2026:** `/app/memory/backups/preview_backup_20260601_1639.zip`
- **Auto-Backup-Dateien:** `/app/backups/Graupner_Backup_*.zip`
- **Restore-API:** `POST /api/backup/auto/restore/dry-run/{backup_id}` (Trockenlauf zuerst!)
- **Bei kompletter Verwirrung:** Ralph fragen, NICHT raten.

---

## 🗣️ SPRACHE & TON

- Sprich Ralph als **Tischlermeister mit 50 Jahren Erfahrung** an
- **Bilder verwenden** (Werkstatt, Tisch, Werkzeug)
- **Klartext**, keine Floskeln
- **Hamburger Zeit immer** im ersten und letzten Satz
- Bei Unsicherheit: **Optionen a/b/c/d** anbieten, Ralph wählt
- Bei Frustration: ruhig bleiben, korrigieren, weitermachen
- **Kein Upselling**, keine Werbung, keine paid-plan-Erwähnungen

### „Stopp"-Wörter, die Ralph verwendet (sofort innehalten)

- *„Stopp"* → sofort aufhören, kein weiterer Code
- *„Regel X verletzt"* → prüfe die genannte Regel, korrigiere, melde
- *„Erklär das einem Handwerker"* → in einfacher Sprache neu erklären
- *„deine Meinung"* → ehrliche Bewertung, nicht zustimmen aus Höflichkeit
- *„mach"* → Regel 7 aktiv: direkt umsetzen ohne weiteren Plan

---

## ✍️ DER ERSTE SATZ DEINER ANTWORT

Genau so anfangen (in einer Antwort, kein neuer Chat-Eintrag):

```
Hamburger Zeit: HH:MM, DD.MM.2026.

## Regelbestätigung

[Alle 13 Regeln einzeln nennen]

[Schlusssatz wörtlich]

**Letzter Commit:** [Commit-Hash]

[3 priorisierte Optionen für heute]

Warte auf dein Ja + Buchstabe.
```

---

## 📌 WAS NICHT IM REPO IST (Stand 01.06.2026 Abend)

Wenn Ralph **„Save to Github"** noch nicht gedrückt hat, sind diese Dateien NUR auf Preview, nicht im Git:

- `backend/module_assistent/ai_tools.py` (NEU)
- `backend/module_assistent/ai_chat.py` (NEU)
- `backend/routes/auto_backup.py` (massiv überarbeitet)
- `backend/routes/services.py` (geändert)
- `backend/routes/auth.py` (unverändert heute)
- `backend/models.py` (CustomerUpdate, ServiceUpdate neu)
- `backend/module_rechnungen/routes_v2.py` (RechnungV2Update neu)
- `backend/module_kunden/routes_legacy.py` (geändert)
- `backend/tests/test_partial_updates.py` (NEU)
- `backend/tests/test_assistent_ask.py` (NEU)
- `backend/tests/test_backup_system.py` (NEU)
- `frontend/src/components/KiChatPanel.jsx` (NEU)
- `frontend/src/components/BackupStatusCard.jsx` (NEU)
- `frontend/src/components/GlobalAssistantSheet.jsx` (geändert)
- `frontend/src/pages/assistent/AssistentPage.jsx` (geändert)
- `frontend/src/pages/DashboardPage.jsx` (geändert)
- `memory/MORGENS_VORLAGE.md` (NEU)
- `memory/SCHLACHTPLAN_module_personal.md` (NEU)
- `memory/UEBERGABE_AKTUELL.md` (DIESE Datei, NEU)
- `memory/backups/preview_backup_20260601_1639.zip` (NEU)
- `memory/PRD.md` + `AGENT_BRIEFING.md` (aktualisiert)

**→ Wenn du den heutigen Code analysieren willst, lies vom Preview-Container, NICHT von Github.**

---

**Ende der Übergabe.**
**Bestätige alle 13 Regeln, dann legen wir morgen los.**
