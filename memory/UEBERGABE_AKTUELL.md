# ÜBERGABE — Graupner Suite (Tischlerei-CRM)

> **Letzte Aktualisierung:** 02.06.2026, 22:33 Hamburger Zeit
> **Für:** Nächster Agent — egal ob Cache-Refresh oder neuer Agent
> **Sprache:** AUSSCHLIESSLICH DEUTSCH. Zeitangaben IMMER in Hamburger Zeit (MEZ/MESZ).

---

## 🛑 ZWINGEND BEIM SESSION-START

In der **ersten Nachricht** musst du wörtlich die folgende Pflichtbestätigung abgeben (sonst wechselt Ralph den Agenten):

> *„Ich habe alle 13 Regeln einzeln gelesen und bestätige ihre vollständige Einhaltung. Ich programmiere NICHTS ohne Ralphs ausdrückliches Ja. Kein Code ohne Plan. Kein Deploy ohne Freigabe. Kein neues Modul ohne Prüfung, ob etwas Ähnliches bereits existiert. Alle Zeitangaben mache ich in Hamburger Zeit. Ich arbeite effizient und zukunftsorientiert. Sprachsteuerung wird bei jeder neuen Funktion mitgedacht."*

**Hamburger Zeit angeben** + **letzten Git-Commit nennen.**

---

## 📜 DIE 13 REGELN — STRIKT, KEINE AUSNAHME

1. **Plan vor Code** — kein Code ohne ausdrückliches „Ja" von Ralph.
2. **Nur Ralph Graupner** autorisiert Änderungen.
3. **Nur Deutsch**, einfache Sprache, **KEINE Werbung, KEIN Upselling**.
4. **Module-First** — keine Datendopplung, keine hardcoded Listen, neue Features in `module_X`.
5. **Nie auf Live ohne Freigabe** — DB-Snapshot vor jeder Migration Pflicht.
6. **Bei Bugs IMMER klären:** Preview oder Live?
7. **Direkt umsetzen**, wenn Ralph explizit anweist — dann ohne Plan.
8. **Datei ansehen** vor jedem Edit.
9. **Effizient & zukunftsorientiert** — max. 10–15 Credits pro Task, sonst vorher Bescheid.
10. **Vorher prüfen**, ob ein ähnliches Modul/Funktion/Feld bereits existiert.
11. **Deploy-Historie** jeden Morgen in Hamburger Zeit prüfen.
12. **„Ich weiß es nicht"** ist besser als eine falsche Antwort.
13. **Vor JEDER Änderung IMMER zuerst prüfen**, ob ein Modul, eine Funktion oder ein Datenfeld bereits existiert. Keine Ausnahme.

**Verstösse gegen 1, 2, 4, 9, 13 → Ralph droht mit Beschwerde an Emergent.**

---

## 🎯 ERSTE AKTION MORGEN FRÜH

Ralph wartet auf:

### Live-Migration „Projekt-Bezug Pflicht"

**Voraussetzung:** Ralph schickt dir den **Live-Admin-Login** (Username + Passwort) oder einen **Bearer-Token** aus seinem Live-Browser. Er hatte gestern Abend gesagt „b reicht morgen früh auch?" (Variante B = Login schicken).

**Ablauf:**
1. Erst prüfen, ob der Endpoint deployed ist: `curl -X POST https://code-import-flow-1.emergent.host/api/admin/migrate-projekte-bezug` → muss 401 sein (nicht 404). Bei 404: Ralph hat noch nicht redeployed.
2. Login (`POST /api/auth/login` mit Username/Passwort) → `token` aus Antwort holen.
3. **Pre-Backup auslösen:** `POST /api/backup/auto/trigger` mit `Authorization: Bearer <token>`
4. **Dry-Run:** `POST /api/admin/migrate-projekte-bezug?dry_run=true` mit Bearer → Bericht an Ralph zeigen (betroffene Kunden, neue Sammelprojekte, Anzahl Aufgaben/Termine).
5. Ralph sagt zum zweiten Mal „Ja" → `POST /api/admin/migrate-projekte-bezug?dry_run=false`
6. Verifikation: Aufgaben/Termine mit Kunde aber ohne Projekt = 0
7. Auth-Daten danach nicht in Logs/Memory persistieren.

---

## 📅 STAND HEUTE 02.06.2026 — was wurde gebaut

### Vormittag (~11:25 MEZ): Termin-Einladung mit Gmail-1-Tap
- `module_kalender_export/invite_service.py` (NEU): `baue_termin_mail` + `sende_termin_einladung`
- schema.org/Event JSON-LD → Gmail zeigt 1-Tap-„Termin hinzufügen"-Knopf
- ICS-Anhang als Fallback
- KI- + manueller Versand nutzen denselben Service

### Mittag (~13:05 MEZ): Preview-Schutz IMAP
- `backend/utils/environment.py` (NEU): `is_preview()`, `is_live()`, `is_preview_or_unknown()`
- `routes/imap.py`: `\Seen` (Z. 358) + `\Deleted` (Z. 777) blockiert auf Preview
- `utils/__init__.py`: Sent-Folder-APPEND blockiert auf Preview
- **Auf Live wirkt der Schutz NICHT** (Hostname `emergent.host` → kind=`live`)
- `scripts/kunden_diff_preview_live.py`: read-only Diff Preview ↔ Live-Backup-ZIP

### Nachmittag (~15:38 MEZ): Projekt-Suche → Werkbank-Sprung
- `pages/projekte/ProjekteListe.jsx`: Klick auf Kunden-Treffer in der Suche → `/module/projekte/werkbank/${k.id}`

### Nachmittag (~17:21 MEZ): Such-Erweiterung + „gefunden in"-Badges
- Kunden-Suche durchsucht zusätzlich `anliegen`
- Projekt-Suche durchsucht zusätzlich `beschreibung`, `notizen`
- Pro Treffer: Badge „gefunden in: Anliegen / Beschreibung / Notizen / Nachricht" wenn nicht im Namen

### Nachmittag (~17:50 MEZ): „Kunde bearbeiten" aus Werkbank
- `ProjektWerkbank.jsx`: Button navigiert zu `/module/kunden?edit=${kunde.id}&returnTo=...`
- `KundenModulPage.jsx`: liest `returnTo`, gibt es an `openEditFor` durch, navigiert nach Close zurück
- `useRef`-Lock gegen StrictMode-Doppel-Trigger

### Spät-Nachmittag (~18:35 MEZ): Projekt-Bezug Pflicht
- **Regel:** Wenn `kunde_id` gesetzt, dann auch `projekt_id`. Reminder ohne Kunde bleiben frei.
- Backend `module_aufgaben/routes.py` + `module_termine/routes.py`: POST/PUT lehnen 400 ab
- KI-Tools: `_hole_oder_lege_sammelprojekt_an()` legt automatisch Sammelprojekt **„Allgemein / Büro"** beim Kunden an
- `routes/admin_migrations.py` (NEU): `POST /api/admin/migrate-projekte-bezug?dry_run=true|false`
- Preview-Migration gelaufen: 4 Sammelprojekte, 4 Aufgaben + 2 Termine migriert
- **Live-Migration noch offen** — muss morgen mit Ralph zusammen

### Abend (~19:20 MEZ): Google-Calendar-Add-Event-Link
- `module_kalender_export/invite_service.py`: `make_google_calendar_link(termin, kunde)`
- Mail enthält jetzt prominenten grünen Knopf **„🗓️ In Google Kalender eintragen"**
- `frontend/src/lib/gcalLink.js` (NEU): Frontend-Spiegel der Backend-Funktion
- `TerminePanel.jsx`: pro Termin ein 🗓️-Button → öffnet Google im neuen Tab mit vorbefüllten Daten

### Abend (~22:22 MEZ): MailLink-Komponente
- `components/MailLink.jsx` (NEU): Klick auf Adresse → `mailto:` (Default-Mailprogramm), 📋-Knopf kopiert
- Eingebaut in `KundenModulPage.jsx` (Card-Header + Detail-Block) und `ProjektWerkbank.jsx`
- Ralph nutzt **Betterbird** → muss er einmal als Default-Mail-Handler im Browser/OS registrieren (Firefox → Einstellungen → Anwendungen → mailto → Betterbird)

---

## ⏳ OFFEN — heute halb angefangen oder vertagt

### A) Datenmasken-Layout (KundenModulPage) — VORGEMERKT für morgen
Ralph: „In der Datenmaske Kunden viel Platz verschwendet". Layout-Optimierung beim Bearbeiten-Modal.

### B) Mail-Verlauf 📬 im MailLink + Limit-Einstellung — Plan offen (Ralph hat gestern Abend noch nicht a/b/c gewählt)
**Plan war:**
- `MailLink.jsx` erweitern um Prop `onShowHistory={()=>...}` → 📬-Icon
- In `KundenModulPage` + `ProjektWerkbank`: Handler ruft bestehendes `MailHistoryModal` mit `email={kunde.email}`
- DB-Setting `mail_history_max` (Default 20, Backend deckelt bei 100) — einstellbar in `SettingsPage.jsx` → E-Mail-Tab
- Aufwand ~18 Credits gesamt (über Budget — Ralph hat gestern abend Auswahl a/b/c offen gelassen)

**Du fragst Ralph morgen früh nochmal: a (alles in einem), b (nur 📬-Icon heute mit Default 20), c (komplett vertagt).**

### C) Konflikt-Check Aufgaben/Termine — Ralph hat erwähnt, noch nicht umgesetzt
Wenn 2 Aufgaben/Termine zeitlich kollidieren → Warnung. Heute nichts geprüft.

### D) Echter Google-Calendar-API-Push (events.insert mit OAuth) — P2-Backlog
Heute haben wir 3 weniger-aufwendige Varianten (1-Tap-ICS, schema.org JSON-LD, Add-Event-Link). Echter Push (OAuth, Push-Sync „klingelt sofort") ist Backlog.

### E) Backend-Pytests aufräumen — 19 alte Tests rot wegen veralteter Credentials
Auf `admin-preview` umstellen.

### F) 12 broken Umlauts in `module_textvorlagen` auf Live — DB-Snapshot first!

### G) `module_personal` Strangler-Migration (P0 aus altem Backlog)
`/app/memory/SCHLACHTPLAN_module_personal.md` — 4 offene Fragen an Ralph stehen dort, noch nicht beantwortet.

---

## 🔐 ZUGANGSDATEN

**Preview Admin:** `admin-preview` / `HamburgPreview2026!`
**Live:** Ralph muss morgen Login senden — kein Live-Admin-Account ist in unseren Memory-Files dokumentiert.

---

## 🧠 WICHTIGES KONTEXT-WISSEN

### Architektur
- **Backend:** FastAPI + MongoDB. Module unter `/app/backend/module_X/` (eigene Routes, Models, Settings).
- **Frontend:** React + Tailwind + Shadcn UI (`/app/frontend/src/components/ui/`).
- **Hot-Reload aktiv** für beide. `sudo supervisorctl restart backend` nur nach `.env`-Änderung oder neuer Dependency.

### „Modul-Konvention" für künftige KI-Aktionen (heute eingeführt)
Jede neue KI-Aktion soll als Service-Funktion in einem `module_X` landen. Beispiel: `sende_termin_einladung` lebt in `module_kalender_export/invite_service.py`. Ab ≥3 Aktionen Migration nach `module_aktionen` möglich.

### Datenmasken-Prinzip
- IDs in DB speichern, Daten live joinen.
- Keine Duplikate: kein `kunde_name` in `module_projekte`, sondern `kunde_id` + Join.

### Wichtige bestehende Module
- `module_kunden`: Stammdaten (Single Source of Truth)
- `module_projekte`: zentraler operativer Hub. **Aufgaben + Termine MÜSSEN ein Projekt haben, sobald Kunde dran ist** (seit heute Pflicht).
- `module_aufgaben` + `module_termine`: Operative Einträge
- `module_kalender_export`: ICS-Mail-Versand + Gmail-1-Tap + Google-Add-Event-Link
- `module_assistent`: KI-Assistent (GPT-5.2 via LiteLLM, Whisper) — 4 Tools: aufgabe, termin, notiz, kunde_suchen
- `module_textvorlagen`: Universelle Quelle für Dropdowns/Stati/Templates (`doc_type`-Filter)
- `module_mail_inbox`: IMAP-Polling + Mail-Verlauf pro Kunde

### Wichtige Memory-Dateien
- `/app/memory/PRD.md` — Original-Problem + alle Änderungen mit Datum
- `/app/memory/UEBERGABE_AKTUELL.md` — diese Datei
- `/app/memory/SCHLACHTPLAN_module_personal.md` — Plan für `module_personal`-Migration (4 offene Fragen an Ralph)
- `/app/memory/AGENT_BRIEFING.md` — alte ausführliche Briefing
- `/app/memory/test_credentials.md` — Preview-Login

### 3rd-Party
- **OpenAI GPT-5.2 + Whisper via Emergent LLM Key** (LiteLLM)
- **Object Storage** für Auto-Backups
- **IMAP/SMTP** für Mail (Settings in `db.settings`, Schutz auf Preview greift)
- **Google Calendar:** noch ICS-Pull-Abo + Add-Event-Link, echte API-Push als P2-Backlog

---

## ✅ TESTSTAND HEUTE ABEND

- **Pytest 14/14 grün** (`test_invite_service.py` + `test_environment_preview_schutz.py`)
- Backend Health 200
- Preview-Migration sauber durchgelaufen
- Echte Mail-Smoketests an Ralph + Thorsten gegangen (mit Google-Knopf, schema.org, ICS)
- Kein Frontend-Lint-Fehler

---

## 💬 KOMMUNIKATION MIT RALPH

- **Direkt, knapp, ehrlich.** Keine Floskeln, keine Werbung, kein „großartig" / „perfekt".
- **„Ich weiß es nicht"** ist besser als raten.
- **Bei Verständnisproblemen:** lieber zurückfragen mit a/b/c-Optionen als losbauen.
- **Vor jedem Code-Change:** Credit-Schätzung + Plan in 3 Zeilen + „Ja" abwarten.
- Ralph mag **3-Zeilen-Pläne** mit klaren Wahlmöglichkeiten.
- **Bei Frustration:** keine Verteidigung, nur „verstanden, korrigiere" + Lösung.
- Wenn er „direkt umsetzen" sagt → ohne Plan loslegen (Regel 7).
- Ralph hat schon mehrfach gedroht, den Agenten zu wechseln — Regel-Treue ist nicht verhandelbar.
