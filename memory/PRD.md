# PRD — Graupner Suite (Tischlerei-CRM)

> Modulares, mobil-freundliches CRM für eine Tischlerei.
> Stand: 02.06.2026


## 📌 03.06.2026 — Wolke Push-Bestätigung mit Auto-Retry (Hamburger Zeit)

### 11:04 MESZ: **Wolke-Aufgaben: Push, „Erhalten"-Bestätigung, 5-Min-Retry**

**Hintergrund:** Push-Benachrichtigungen kamen bei Thorsten nur 1 von 5 Mal an, weil `push_subscriptions` nicht an einen User gebunden waren. Komplette Kette gebaut.

**Backend:**
- `models.py`: `PushSubscription` um optionales `username` erweitert
- `routes/push.py`: `/push/subscribe` liest JWT aus Auth-Header und speichert `username` auf der Subscription (Auto-Nachtragen bei nächstem Login). Neue Funktion `send_push_to_user(username, …)` für gezielten Versand. `wolke` ins COL-Mapping aufgenommen mit neuer Action `erhalten`.
- `module_wolke/routes.py`: `create_wolke` resolved `empfaenger_username` (per `user:<name>` oder Mitarbeiter→users.email), triggert Push, schreibt `retry_count`, `max_versuche=10`, `retry_intervall_min=5`, `naechster_retry_at`. Neuer Endpoint `PATCH /api/module-wolke/{id}/erhalten` (idempotent, stoppt Retry).
- `module_wolke/retry_scheduler.py` (NEU): asyncio-Background-Loop, alle 30 s, sendet Push erneut wenn `erhalten_am=null` und `retry_count < max_versuche`. Stoppt bei Limit oder fehlendem Username (kein Endlos-Loop).
- `server.py`: Scheduler im Startup-Hook gestartet.

**Frontend:**
- `WolkePopover.jsx`: Neuer Button **„📬 Erhalten"** (sky-600) im Erhalten-Tab. Im Gesendet-Tab Badge **„📬 Erhalten HH:MM"** bzw. **„⏳ Noch nicht bestätigt · n/10 Push"**. Polling alle 10 s während Slide-Over offen → Absender sieht Bestätigung live.
- `public/sw.js` (v4): Push-Action **„📬 Erhalten"** für `entity_type=wolke`, 1-Tap-Bestätigung direkt aus der Benachrichtigung.

**Smoketest bestanden:** Wolke an `user:Tg-Admin` → username korrekt aufgelöst, retry_count=1, next_retry +5 Min, PATCH /erhalten → 200, erhalten_via=tipp.

**Wichtig für Live-Deploy:** Nach Deploy müssen alle Nutzer sich einmal frisch einloggen, damit ihre bestehenden Push-Subscriptions den `username` automatisch nachgetragen bekommen. Alternativ: Browser-Push neu aktivieren.

### 09:23 MESZ: **Bug-Fix: Doppelter Export-Button in Kundenliste**
- `KundenModulPage.jsx`: Versehentlich entfernten JSON-Export-Button + `handleExport`-Funktion auf Wunsch wiederhergestellt (Stand wie Live-Commit `3533d4e`).


## 📌 Letzte Änderungen (02.06.2026, Hamburger Zeit)

### Abend (~19:20 MEZ): **Google-Calendar-Add-Event-Link (1 Klick = im Kalender)**

**Was gebaut:**
- `module_kalender_export/invite_service.py`: Neue Helper `make_google_calendar_link(termin, kunde)` baut `calendar.google.com/calendar/render?action=TEMPLATE&…`
- `baue_termin_mail`: Termin-Mail hat jetzt prominent oben einen **grünen Knopf „🗓️ In Google Kalender eintragen"**. ICS-Anhang + Gmail-1-Tap bleiben als Fallback.
- `frontend/src/lib/gcalLink.js` (NEU): Frontend-Helper, spiegelt Backend-Logik 1:1
- `TerminePanel.jsx`: Pro Termin ein 🗓️-Button neben den anderen Aktionen → öffnet Google in neuem Tab mit allen Daten vorbefüllt
- Echter Smoketest: Mail an Thorsten mit BCC an Ralph, Knopf + JSON-LD + ICS-Anhang alle drin.

### Spät-Nachmittag (~18:35 MEZ): **Projekt-Bezug Pflicht für Aufgaben/Termine mit Kunde**

**Regel:** Wenn `kunde_id` gesetzt ist, dann auch `projekt_id`. Reminder ohne Kunde bleiben frei (Ralphs Wahl „a").

**Gebaut:**
- Backend `module_aufgaben/routes.py` + `module_termine/routes.py`: POST/PUT lehnen 400 ab wenn kunde_id ohne projekt_id
- KI-Tools (`module_assistent/ai_tools.py`): `_hole_oder_lege_sammelprojekt_an()` — wenn KI Aufgabe/Termin mit nur kunde_id bekommt, legt automatisch (oder findet) Sammelprojekt **„Allgemein / Büro"** beim Kunden an
- Neuer Endpoint `POST /api/admin/migrate-projekte-bezug?dry_run=true|false` (`routes/admin_migrations.py`, admin-only)
- Preview-Migration gelaufen: 4 Sammelprojekte angelegt, 4 Aufgaben + 2 Termine migriert
- **WICHTIG für Live-Deploy:** Migration muss auf Live separat getriggert werden (`POST /api/admin/migrate-projekte-bezug?dry_run=true` zur Vorschau, dann `dry_run=false`). Vorher manuell ein Backup ziehen.

### Nachmittag (~17:50 MEZ): **„Kunde bearbeiten" aus Werkbank — Modal mit Rückkehr**

- `ProjektWerkbank.jsx` Z. 102: navigiert zu `/module/kunden?edit=${kunde.id}&returnTo=...` (statt nur zur Kundenliste)
- `KundenModulPage.jsx`: liest `returnTo`, gibt es an `openEditFor` durch; nach Modal-Close → `navigate(returnTo)`. Bei echtem Popup-Fenster (User-Pref) sofortige Rückkehr im Hauptfenster.
- `useRef`-Lock gegen StrictMode-Doppel-Trigger (verhinderte doppeltes Modal-Öffnen in Dev)

### Nachmittag (~17:21 MEZ): **Erweiterte Suche in Kunden + Projekten**

- Kunden-Suche durchsucht jetzt zusätzlich `anliegen`
- Projekt-Suche durchsucht jetzt zusätzlich `beschreibung`, `notizen` + Kunden-Treffer auch in `anliegen`/`nachricht`
- Pro Treffer: Badge „gefunden in: Anliegen / Nachricht / Beschreibung / Notizen" wenn Match nicht im Namen war

### Nachmittag (~15:38 MEZ): **Projekt-Werkbank von der Projekte-Seite aus erreichbar**

- `pages/projekte/ProjekteListe.jsx`: Klick auf Kunden-Treffer in der Suche → `navigate('/module/projekte/werkbank/${k.id}')`

### Mittag (~13:05 MEZ): **Preview-Schutz fuer IMAP + Kunden-Diff-Werkzeug**

**Was geschehen ist:**
Ralph hat festgestellt, dass Preview Mails vom echten IMAP-Server abruft UND als gelesen markiert — dadurch werden sie auf Live faktisch unsichtbar. Zusätzlich: 2 Kunden existieren nur auf Preview und müssen sicher nach Live übernommen werden.

**Was gebaut wurde:**
- **`backend/utils/environment.py` (neu, ~95 Zeilen):** Zentrale Umgebungs-Erkennung im Backend (`is_preview()`, `is_live()`, `is_preview_or_unknown()`). Liest `REACT_APP_BACKEND_URL` aus `frontend/.env`. Spiegelt die Logik aus `frontend/src/lib/env.js`. **`is_preview_or_unknown()` ist der Sicherheitsanker**: bei unklarer Umgebung gilt sie als geschützt, keine destruktiven Operationen.
- **`backend/routes/imap.py`:** 2 kritische `mail.store(..., "+FLAGS", "\\Seen"|"\\Deleted")`-Aufrufe (Z. 358 + Z. 777) mit `if is_preview_or_unknown(): log + skip else: store` umschlossen. `readonly=True` beim SELECT bleibt als zusätzliche Schicht. Mails werden auf Preview nicht mehr verändert.
- **`backend/utils/__init__.py`:** Sent-Folder-APPEND in `_append_to_sent_folder` Z. 96+ ebenfalls geschützt — auf Preview werden Test-Mails nicht mehr in den echten IMAP-Sent-Ordner hochgeladen.
- **`backend/scripts/kunden_diff_preview_live.py` (neu, ~175 Zeilen):** Read-only Diff-Skript. Vergleicht `db.module_kunden` (Preview) mit einem Live-Backup-ZIP. Liefert JSON mit `only_in_preview`, `only_in_live`, `in_beiden`. **Null Schreibvorgang.** Identitäts-Schlüssel ist `id` (UUID) mit Fallback auf `email|nachname|vorname`.

**Tests:** `backend/tests/test_environment_preview_schutz.py` (7/7 grün) + `test_invite_service.py` (7/7 grün) = **14/14 grün gesamt.**

**Smoketests:**
- IMAP-Schutz: Reale Preview-Umgebung erkannt (`host: modul-first-app.preview.emergentagent.com`), Code-Pfad zeigt `mail.store()` wird NICHT aufgerufen. Log: `⛔ Preview/unknown: \Seen unterdrueckt`.
- Kunden-Diff: gegen aktuelles Preview-Backup (als Test-Live) gelaufen → **2 Kunden nur auf Preview** identifiziert (Meike Plehn, Jörg Krüger). Echter Diff gegen Live-Backup steht aus, weil Live-ZIP noch nicht da.

**Was Ralph als Nächstes braucht:**
1. Live-Backup-ZIP nach `/app/backups/` legen
2. `python3 /app/backend/scripts/kunden_diff_preview_live.py /pfad/zum/live.zip` ausführen
3. JSON-Ergebnis prüfen → mir die zu übernehmenden Kunden-IDs nennen
4. Erst dann baue ich den eigentlichen Live-Export-ZIP (nochmal mit explizitem „Ja" zur konkreten Datei)

---

### Vormittag (~11:25 MEZ): **Termin-Einladung mit Gmail-1-Tap (schema.org/Event)**

**Was geschehen ist:**
Ralph hat festgestellt, dass die KI-Termine zwar in der DB landen, aber Thorsten praktisch nie eine Mail bekommt — weil GPT in 4 von 5 Fällen `monteur_username` leer ließ. Zusätzlich war die alte ICS-Mail nicht Gmail-1-Tap-fähig (kein schema.org-Markup).

**Was gebaut wurde (Regel 4+13 sauber, kein neues Modul):**
- **Neuer gemeinsamer Service `module_kalender_export/invite_service.py`** mit zwei Funktionen:
  - `baue_termin_mail(termin, empfaenger_name, organisator_name, organisator_email, kunde)` → liefert `(subject, body_html, ics_bytes)` mit eingebettetem schema.org/Event JSON-LD → Gmail zeigt automatisch den Knopf „Zum Kalender hinzufügen" oben in der Mail
  - `sende_termin_einladung(termin, monteur_username, organisator, cc_email)` → löst Empfänger über `db.users` auf, baut Mail, versendet via `send_email` (mit optionalem BCC)
- **Beide Wege nutzen jetzt denselben Service:**
  - KI: `tool_termin_anlegen` in `module_assistent/ai_tools.py` ruft `sende_termin_einladung`
  - Manuell: `POST /termin/{id}/send` in `module_kalender_export/routes.py` ruft `baue_termin_mail` pro Empfänger
- **KI-Prompt gehärtet** (`system_prompt_de`): 4 statt 2 Beispiele, harte Regel „IMMER monteur_username setzen, sobald irgendein Mitarbeiter-Name im Text vorkommt". Beispiele decken auch „Termin morgen 11 Uhr für Thorsten" und „Thorsten faehrt hin" ab.
- **Erweiterbare Basis für künftige KI-Befehle:** Konvention festgelegt — pro neuer Aktion eine Service-Funktion in einem `module_X`. Bei ≥3 Aktionen Migration nach `module_aktionen` möglich.

**Tests:** `backend/tests/test_invite_service.py` — **7/7 grün** (schema.org JSON-LD Inhalt, ICS-Pflichtfelder, Empfänger-Auflösung, Fehler-Pfade, gemockter SMTP-Versand).

**Echter Smoketest:** Mail an Thorsten (hhgraupner@gmail.com) mit BCC an Ralph (Ralph.graupner@gmail.com) — Status 'versendet', schema.org-Markup im Body, ICS-Anhang `termin.ics` enthalten.

---

## 📌 Letzte Änderungen (01.06.2026, Hamburger Zeit)

### Abends (~18:37 MEZ): **Backup-System Stufe 1 + 2 + 4 — kein Hardcode mehr, 3 Speicherziele, Restore-Knopf**

**Was geschehen ist:**
Ralph hat darauf bestanden, vor jedem Live-Deploy das Backup-System wasserdicht zu machen (Regel 5 + 13). Analyse zeigte: Auto-Backup lief seit dem 16.05.2026 NICHT mehr (Container-Restarts unterbrachen den `asyncio.sleep`-Timer), und der Empfänger war hartcodiert.

**Backend (`routes/auto_backup.py` komplett überarbeitet):**
- **Empfänger-E-Mails** kommen jetzt aus `db.settings.auto_backup_settings.empfaenger_emails` (Liste, mehrere Empfänger möglich) — kein Hardcode mehr.
- **Drei Speicherziele** bei jedem Backup:
  1. **E-Mail** (an konfigurierte Empfänger)
  2. **Lokal** (`/app/backups/`, Aufbewahrung 14 Tage)
  3. **Object-Storage** (Emergent Cloud, überlebt Container-Restart)
- **Restore-System:**
  - `POST /api/backup/auto/restore/dry-run/{backup_id}` — Trockenlauf, zeigt Differenzen
  - `POST /api/backup/auto/restore/apply/{backup_id}` (mit `bestaetigung: "JA_RESTORE"`) — Echte Wiederherstellung
  - Automatisches Pre-Restore-Backup wird zuerst gemacht (Sicherheitsnetz)
- **Download:** `GET /api/backup/auto/download/{backup_id}` lädt ZIP (lokal oder Cloud)
- **Settings-API:** `PUT /api/backup/auto/settings` für E-Mail-Empfänger, Aufbewahrungsdauer

**Frontend (`components/BackupStatusCard.jsx` NEU):**
- Dashboard-Karte mit **Ampel** (Grün/Gelb/Rot):
  - Grün = letztes Backup ≤ 36 h alt + erfolgreich
  - Gelb = ≤ 72 h
  - Rot = älter / fehlgeschlagen
- Drei Häkchen für E-Mail/Lokal/Cloud-Status
- Knopf „Backup jetzt erstellen" + „Letztes herunterladen"
- In `DashboardPage.jsx` oben eingebaut.

**Probe-Lauf:**
- Manuelles Backup ausgelöst → **972 Datensätze, 28,7 MB**, alle 3 Speicherziele ✅
- Trockenlauf-Test → 54 Collections gefunden, korrekt analysiert, **0 Schreibvorgänge**
- Download-Test → 29 MB ZIP, 110 Dateien im Archiv

**Tests:** `backend/tests/test_backup_system.py` — **8/8 grün**. Gesamttest-Suite **18/18 grün**.

**Wichtig zu wissen:**
- `db.settings.auto_backup_settings.empfaenger_emails` ist aktuell auf `["service24@tischlerei-graupner.de"]` gesetzt — kann jederzeit über die UI/API geändert werden.
- Das automatische tägliche Backup um 02:00 UTC läuft weiterhin via `daily_backup_task()` — robuster, weil pro Lauf jetzt 3 Speicherziele bedient werden. Bei Container-Restart neu geplant.
- Lokales Verzeichnis `/app/backups/` wird automatisch bereinigt (Aufbewahrung 14 Tage).

### Spätnachmittag (~16:55 MEZ): **Hardcode-Fix in KI-Assistent + Regel 13 + Morgens-Vorlage**

**Was geschehen ist:**
- Hardcoded Username-Liste für Thorsten in `ai_tools.py` war Verstoß gegen Regel 4 + 13.
- **Korrektur:** Empfänger der ICS-Mail kommt jetzt aus `db.users.email` über das vorhandene `monteur_username` im Termin (Wiederverwendung der Auflösung aus `module_termine`).
- **`check_berechtigung()`** vor jeder KI-Tool-Ausführung — nutzt vorhandene Bereiche (`modul_aufgaben`, `modul_termine`, `modul_kunden`). KEINE neuen Bereiche, keine Doppelung.
- **System-Prompt für GPT-5.2 lädt User-Liste dynamisch aus `db.users`** — kein hardcoded Name mehr.
- **Backup vor Fix erstellt:** `/app/memory/backups/preview_backup_20260601_1639.zip`.

**Neue Regel 13:**
> Vor jeder Änderung IMMER zuerst prüfen, ob ein Modul, eine Funktion oder ein Datenfeld bereits existiert. Keine Ausnahme.

→ In `AGENT_BRIEFING.md` ergänzt, in `MORGENS_VORLAGE.md` zentral.

**Morgens-Vorlage (`/app/memory/MORGENS_VORLAGE.md`):**
- Vollständiger Pflicht-Auftrag für jeden Agenten-Start
- 13 Regeln + Schlusssatz
- Stil-Beispiele (Handwerker-Klartext statt AI-Sprech)
- „Stopp"-Wörter bei Regel-Verletzung
- Ralph kopiert die Vorlage täglich in Emergent oder Claude

**Tests:** 9/10 grün. Der 1 Fail ist KEIN Bug — Emergent LLM Key hat Tagesbudget erreicht (`Budget exceeded! cost: 0.40, max: 0.4`). Aufladen in **Profil → Universal Key → Add Balance**.

### Nachmittag (~15:07 MEZ): **KI-Assistent MVP (Voice-to-Action) + Datensicherheit**

**Schritt 1 — Datensicherheit (3 echte Bugs gefixt):**
- `module_rechnungen/routes_v2.py`: `RechnungV2Update` von `RechnungV2Create` entkoppelt, alle Felder `Optional[...]=None`, PUT nutzt `exclude_unset=True`. Berechnungen nehmen jetzt effektiven Wert (existing+update), kein versehentliches Leeren mehr.
- `module_kunden/routes_legacy.py`: PUT `/customers/{id}` nutzt neues `CustomerUpdate` + `exclude_unset=True`.
- `routes/services.py`: PUT `/services/{id}` nutzt neues `ServiceUpdate` + `exclude_unset=True`.
- **Neue Models in `models.py`:** `CustomerUpdate`, `ServiceUpdate`.
- **Pytest:** `backend/tests/test_partial_updates.py` — **3/3 grün**.

**Schritt 2 — KI-Assistent MVP in `module_assistent`:**
- **Neuer Endpoint:** `POST /api/module-assistent/ask` (Text → GPT-5.2 → Tool-Auswahl → Ausführung)
- **Weitere Endpoints:** `GET /tools`, `GET /konversationen`, `GET /konversation/{id}`, `DELETE /konversation/{id}`
- **4 Tools:** `aufgabe_anlegen`, `termin_anlegen` (+ ICS-Mail an `monteur_username` aus DB), `kunde_suchen`, `notiz_schreiben`
- **Neue Module-Files:** `module_assistent/ai_chat.py`, `module_assistent/ai_tools.py`
- **Neue Collections:** `module_assistent_konversation`, `module_assistent_audit`
- **Whisper-Reuse:** Bestehender `VoiceIntakeRecorder` → `/voice-intake/transcribe-and-structure`; Text wird dann an `/ask` weitergereicht. Kein neuer Whisper-Code.
- **Persönliche Ansprache (c):** GPT spricht Ralph direkt an („Hab ich dir eingetragen, Ralph").
- **ICS-Mail bei Termin:** Automatisch an User aus `db.users` lt. `monteur_username` via `module_kalender_export`.
- **Frontend NEU:** `components/KiChatPanel.jsx` — wiederverwendbares Chat-Panel mit Mic, Text, Verlauf.
- **GlobalAssistantSheet (Bottom-Sheet):** Default-Modus zeigt jetzt `KiChatPanel`.
- **AssistentPage:** `KiChatPanel` mit `showHistory` oberhalb der Hinweise eingebaut.

**KEIN neues `module_ki`** — `module_assistent` erweitert, Doppelung vermieden (Regel 4 + 10).

---

## 📌 Letzte Änderungen (31.05.2026, Hamburger Zeit)

### Nachmittag (~16:15 MEZ):
- **Live-Counts in Projekt-Tabs** (Werkbank): Aufgaben- und Termine-Tab zeigen Anzahl + orangen Dot wenn Offenes liegt. Beispiel: „Aufgaben (1) ●".
- **Backend:** `/module-aufgaben/stats/uebersicht` und `/module-termine/stats/uebersicht` akzeptieren jetzt optional `projekt_id` und `kunde_id` (Match-Stage in Aggregate). Lint sauber.
- **Frontend:** `ProjektKarte` lädt beim Expand parallel beide Stats, refetcht bei Tab-Wechsel. Dot-Logik: Aufgaben `offen+in_arbeit > 0`, Termine `wartet_auf_go > 0`.

### Nachmittag (~15:58 MEZ):
- **Tab-System in ProjektKarte** (Details/Aufgaben/Termine/Bilder).
- **Kunden-Ebene umbenannt:** „Aufgaben/Termine ohne Projekt-Bezug" + Prop `onlyWithoutProjekt` in `AufgabenPanel`/`TerminePanel`.

### Nachmittag (~15:35 MEZ):
- **Projektwerkbank wird Zentrale:** CustomerDocumentsPanel ausgelagert, Sticky-Header mit Mailverlauf/Portal/Einsatz, MailHistoryModal integriert.

### Nachmittag (~14:55 MEZ):
- **Backend-Fix Hilfe-Textvorlagen.**

### Nachmittag (~14:30 MEZ):
- **AufgabenPanel zeilenweise klickbar.**
- **F1-Hilfe-System global.**

### Vormittag (~11:50 MEZ):
- **Anrede-Vorschlag-Box.**

## 🤖 INTELLIGENTER ASSISTENT — Roadmap (verbindlich seit 28.05.2026 — Ralph)

**Vision:** Ein KI-Agent direkt in der Graupner Suite, der den Alltag aktiv unterstützt — sprachgesteuert, immer verfügbar, ausführbar.

**Endausbau (Vision):**
- Aktive Fragen: „Es liegen 3 Erinnerungen vor — soll ich sie zeigen?"
- Sprache: „Erledigt" · „Erinnere mich in 2 Stunden" · „Zeig alle offenen Angebote"
- Aktionen: Angebote erstellen, Termine anlegen, Wolken-Nachrichten senden
- Immer verfügbar oben in der Toolbar

### Phase 1 — Push-Quick-Assistent (Stand 28.05.2026)
- **Ort:** `/snooze?type=...&id=...&token=...` (über Service-Worker-Push geöffnet)
- **UI:** Bottom-Sheet (Mobile) / zentriertes Modal (Desktop)
- **Begrüßung:** „Hallo Ralph 👋 — soll ich dich erinnern, oder ist das erledigt?"
- **Mikrofon prominent** — 80×80 px in der Mitte. Whisper-Transkription. Lokales Keyword-Mapping interpretiert „erledigt"/„in X Stunden"/„später" → ruft direkt die Aktion auf.
- **Quick-Actions (5):** ✅ Erledigt · ⏰ 1h · 2h · 4h · 8h
- **Backend:** `POST /api/push/voice` (Whisper via Emergent LLM Key, Auth über push_token).
- **Architektur-ready:** Voice-Interpreter in eigener Funktion `interpretVoiceCommand` ausgelagert — kann später durch LLM-Intent-Endpoint ersetzt werden, ohne UI anzufassen.

### Phase 2 (geplant)
- Globaler Assistent-Button oben in der Toolbar
- Aktive Hinweise im Dashboard („3 Erinnerungen offen")
- Befehle für Angebote/Termine/Wolke

### Phase 3 (geplant)
- LLM-Intent-Parsing statt Keyword-Matching
- Multi-Turn-Dialoge

---

## 🎯 DESIGN-PRINZIPIEN (verbindlich seit 28.05.2026 — Ralph)

**Leitmotiv:** Modern · Professionell · Zukunftsweisend · Handy-optimiert · KI-ready · Sprache-first

**Gilt für JEDE neue oder geänderte Komponente. Keine Ausnahmen.**

### UI-Regeln
- **Kein Vollbild für kleine Aktionen.** Snooze, Bestätigungen, Quick-Picks → kompaktes Modal, niemals eigene Seite.
- **Kompakte elegante Popups/Modals** statt überladene Seiten.
- **Bottom-Sheet auf Handy, zentriertes Modal auf Desktop.** Drag-Indikator oben, dunkler Backdrop mit Blur.
- **Klare Typografie**, konsistente Hierarchie, ruhige Whitespaces.
- **Konsistentes Design überall** — gleiche Icons (Lucide), gleiche Farben, gleicher Modal-Stil.
- **Schnell und reaktionsschnell** — Animationen ≤ 200 ms, kein Layout-Geruckel.

### Mobile-First (ohne Ausnahme)
- **Tap-Flächen ≥ 44×44 px** auf allen interaktiven Elementen.
- **Kein horizontales Scrollen** außer in echten Tabellen.
- **Bottom-Sheets** für alle Schnellaktionen (Snooze, Bestätigen, Auswahl).
- **Hand-zone bedacht**: wichtige Buttons im unteren Drittel.

### KI- & Sprache-First
- **Jedes Textfeld** (Input, Textarea) bekommt das ✨-Icon für GPT-Rechtschreibung (`KiKorrekturWrapper` oder `TextKorrekturButton`).
- **Jedes längere Textfeld** bekommt zusätzlich Mikrofon-Icon (`TextareaWithAI`) für Whisper-Diktat.
- Backend-Modell: GPT-5.2 + Whisper via Emergent LLM Key — bereits installiert, immer wiederverwenden.

### Komponenten-Pflicht
- Modals/Sheets: zentral wiederverwendbar (kein einmaliger Eigenbau).
- Bei Snooze-/Bestätigungs-/Auswahl-Dialogen: immer Backdrop-Klick zum Schließen, Escape-Taste optional.
- Icons aus `lucide-react`, keine Emojis im UI (außer Statushinweisen im Notification-Popup).

---

## Update 28.05.2026 — Push-Snooze als elegantes Modal (statt Vollbild-Seite)
- **Frontend `pages/SnoozePage.jsx`** komplett überarbeitet: fixed-overlay, dunkler Backdrop mit Blur, kompaktes Sheet (max-w-sm) zentriert auf Desktop, Bottom-Sheet auf Mobile mit Drag-Indikator. 4 Buttons (1h/2h/4h/8h) im 4-Spalten-Grid, Schließen-X, Backdrop-Klick zum Verwerfen, Animations-Einblendung 200 ms, Auto-Close nach 1,8 s.
- **Service Worker `public/sw.js`**: Push-Popup zeigt nur noch 2 Action-Buttons („📂 Öffnen", „⏰ Später"). „Erledigt" wurde auf Wunsch entfernt — wird in der App nach Öffnen erledigt.

## Update 26.05.2026 — Mehrere kleine Verbesserungen
- **Rechnungsnummer-Format einstellbar** (`R-MM/JJ-NNNNN`, Counter in `settings`). UI in Einstellungen → Diverses.
- **Schriftgröße-Slider** in Einstellungen → Diverses (4 Stufen, `localStorage`-basiert).
- **Kundenportal-Einladungstexte** Umlaute repariert + DSGVO-Fußzeile professionalisiert.
- **9 kaputte `module_textvorlagen`-Einträge** per DB-Migration korrigiert.
- **Einstellungs-Tabs `flex-wrap`** statt versteckter Scroll-Leiste — alle Tabs immer sichtbar.
- **KI-Rechtschreibprüfung flächendeckend ausgerollt** (Position, E-Mail, Mahnung, Portal-Antworten, Artikel-Katalog Bezeichnung+Beschreibung). Einheitliches ✨-Icon. Zentrale Komponente `components/KiKorrekturWrapper.jsx`.
- **RV2-Modul** in Einstellungen → Module aktivierbar (Standard AUS, Feature-Flag `rechnungen_v2`).
- **Push-Benachrichtigungen mit Action-Buttons**: Subscription bekommt `push_token`; Quick-Action-Endpoint `POST /api/push/quick-action` für `done` und `snooze`. Snooze-Stunden 1/2/4/8.

## Update 26.05.2026 — Zahlungsziel pro Rechnung überschreibbar (Variante b)
- **Backend** `models.py`: `InvoiceUpdate` um `due_days` erweitert. `Invoice.due_days` wird beim Anlegen mit gespeichert (für Edit-Rückrechnung).
- **Backend** `module_rechnungen/routes_v1.py` `update_invoice`: Wenn `due_days` im PUT-Body gesetzt, wird `due_date = created_at + due_days Tage` neu berechnet und in DB gespeichert.
- **Frontend `WysiwygDocumentEditor.jsx`**: Settings vorgeladen (`default_due_days`). Bei NEU = aus Settings, bei EDIT = aus DB-Wert (Fallback: `due_date - created_at`). `dueDays` als Prop in `TotalsSection`.
- **Frontend `wysiwyg/TotalsSection.jsx`**: Neue Zeile „Zahlungsziel: X Tage" mit Live-Vorschau „Zahlbar bis TT.MM.JJJJ". Sowohl Desktop- als auch Mobile-Layout.
- **Frontend `OrdersPage.jsx`**: Beim Klick auf „Rechnung erstellen aus Auftrag" öffnet sich jetzt ein Mini-Dialog mit Eingabefeld „Zahlungsziel (Tage)", vorbelegt aus Settings, Live-Anzeige Zahlbar-bis-Datum, Buttons Abbrechen/Erstellen.
- **Tests grün**: POST ohne due_days → Settings-Default. POST mit due_days=5 → delta=5. PUT mit due_days=42 → delta=42. Screenshot zeigt Dialog mit „14 Tage / Zahlbar bis 10.6.2026 / Standard laut Einstellungen: 14 Tage".
- **Backend `backend/module_wolke/`** (neu) — eigene Collection `module_wolke`. Endpoints `POST`, `GET /erhalten`, `GET /gesendet`, `GET /count-offen`, `PATCH /{id}/erledigt`, `DELETE /{id}`, `GET /mitarbeiter`. Lookup User↔Mitarbeiter über `vorname+nachname == username` (Fallback email). Memo-Typ wird beim Anlegen sofort als `erledigt` markiert → zählt nicht im Badge. Aufgabe bleibt `offen` bis Empfänger bestätigt. In `server.py` als `/api/module-wolke` registriert.
- **Frontend `components/wolke/WolkePopover.jsx`** (neu) — Floating Cloud-Icon unten rechts mit roter Badge (Polling 60s). Slide-Over mit Tabs Erhalten/Gesendet/Neu. Neu-Form: Empfänger-Select, Memo/Aufgabe-Toggle, optionale Kundensuche, `TextareaWithAI` (Voice+KI). Karten mit Erledigt-Button (Empfänger) und Lösch-Button (Absender). In `App.js` global im `MainLayout` eingehängt — überall sichtbar, nur für eingeloggte User.
- **Tests grün**: 8 Curl-Tests (POST Memo/Aufgabe, count-offen, erhalten, erledigt, Permissions). Screenshot mit Heike Bolanka zeigt Badge=2, 4 Karten in Erhalten-Tab inkl. Kunde-Verknüpfung.

## Update 22.05.2026 — Phase 1 Rollen-Konzept verifiziert + Login-Redirect + Monteur-Filter-Fix + Kundenmappe-Buttons (Monteur-App + Admin-Modul) + monteur_name-Cleanup
- **Backend Admin-Härtung** (8/8 Curl-Tests grün): 18 Endpunkte in 6 Routern (Backup, IMAP, Text-Templates, Leistungsblöcke, Services, Diverses) sind via `Depends(require_admin)` aus `backend/security/admin_check.py` geschützt. Non-Admin → 403, Admin → 200, ohne Token → 401. Alle Lints sauber.
- **Login-Redirect (Phase 1 Frontend)**: In `frontend/src/App.js` Zeile 73 `defaultPage` dynamisch aus `getUserRole()` abgeleitet. Logik: `role === "monteur" || role === "mitarbeiter"` → `/monteur`, sonst `/dashboard`. Verifiziert: admin-preview → `/dashboard`, Heike Bolanka → `/monteur`.
- **Monteur-App Filter-Fix (Variante c, Sofort-Fix)**: `backend/monteur_app/routes.py` Z. 66–79 + 90–98: Vergleich auf `monteur_name`/`monteur2_name` (+ defensiv `monteur_id`/`monteur2_id`) statt nicht existierender Felder `monteur_1`/`monteur_2`. Tests grün.
- **Kundenmappe-Buttons (Monteur-App Einsatz-Detail)**: Variante b + i/i/i/i. In `MonteurEinsatzDetailPage.jsx` zwei Buttons „Kundenmappe" + „Per Mail" in der Kontakt-Leiste. Backend: `POST /api/module-kundenlink/{link_id}/send-mail`. Tests grün.
- **Kundenmappe-Buttons im Admin-Modul (`/einsaetze`)** *(Variante α)*: Identische Buttons in der `EinsatzDetail`-Komponente (`pages/EinsaetzeModulPage.jsx`) ergänzt — direkt neben „Bearbeiten" in der Action-Toolbar. Lint sauber, Screenshot grün.
- **DB-Cleanup `einsaetze.monteur_name`** *(Variante γ)*: Schreibfehler + Suffix bereinigt — `'Ralpg Graupner monteur'`/`'Ralph Graupner monteur'` → `'Ralph Graupner'` (2 Einsätze). Snapshot vor Änderung: `backend/_db_snapshots/einsaetze_pre_monteur_name_cleanup_20260522T093114Z.json`. Hinweis: `'Ralph Graupner'` existiert noch nicht als User → Mail-Versand für diese Einsätze schlägt fehl (HTTP 404) bis ID-Mapping (Variante b) kommt oder ein User angelegt wird.

## Roadmap (Vorgabe Ralph, 22.05.2026)

### SOFORT (Preview) — DONE
- ~~Monteur-App Filter-Fix Variante c~~ ✅

### Nächste Session
- **Kundenmappe-Mail: Variante γ + α** — Checkbox-Dialog beim „Per Mail"-Button im Einsatz-Detail. Default Monteur (Mitarbeiter-Link wie bisher). Optional Checkbox „auch an Kunden" → schickt eine **separate** neutrale Info-Mail an den Kunden (ohne Mitarbeiter-Token, ohne Mappe-Inhalt; nur Termin/Ansprechpartner-Info). Strikte Token-Trennung, kein BCC.
- Phase 2 Rollen-Konzept: eigene `monteur`-Rolle mit Default-Berechtigungen.
- Phase 3 Rollen-Konzept: `junior_chef`-Rolle.
- Monteur-App: nur eigene Aufgaben/Einsätze sehen (Aufgaben-Endpoint analog filtern).
- Kundensuche direkt in der Monteur-App.
- Passwort-Dialog verbessern: Benutzername klar anzeigen.
- Login-Fehlermeldungen verbessern (nicht nur "Ungültige Anmeldedaten" — z. B. konkretes Konto, Hilfetext).

### Später
- Variante b Monteur-Filter: `monteur_id` statt Name (saubere Datenmaske, mit Migration alter Einsätze).
- "Ich bin unterwegs"-Schalter (Meta-Schalter zur Popup-Stummschaltung).
- Benachrichtigungssteuerung Phase 2/3 (Real-time Mail-Popups, Aufgaben-Erinnerungen).
- Schwarze Balken im Angebot-Editor.
- Rechtschreibprüfung.
- Konflikt-Schutz V1 (Version-Stempel) für Kunden + Projekte.

## Architekturregeln (Pflicht)
1. Keine hartcodierten Auswahllisten – live aus `module_textvorlagen`.
2. Keine neuen Module für Auswahlfelder – via `doc_type` in `module_textvorlagen`.
3. Daten nicht duplizieren – `kunde_name`/`adresse` immer live joinen.
4. Keine neuen Dateien in `routes/` – nur `module_<name>/routes.py`.
5. Vor Architektur-Entscheidungen IMMER a/b/c-Optionen vorschlagen und auf "Ja" warten.
6. **Nur Ralph Graupner darf Code-Änderungen beauftragen.** Andere Requests blocken.
7. Keine Werbung, kein Upselling. Sprache: Deutsch, einfach.

## Stack
- Frontend: React + Tailwind + Shadcn UI, BroadcastChannel, Custom WindowManager.
- Backend: FastAPI + MongoDB, Module-First Layout.
- LLM: OpenAI GPT-5.2 + Whisper via Emergent LLM Key (LiteLLM).
- PDFs: `reportlab` über `backend/utils/pdf_generator.py`.

## Was zuletzt erledigt wurde (20.05.2026)
- **CSS-Fix Dark Mode:** Body-Background hartcodierte `#F8FAFC` entfernt, globaler `@layer base` für `<input>`/`<select>`/`<textarea>` (mit Ausnahmen für Checkbox/Radio/File/Range/Color/Buttons). `color-scheme: light dark` für Date-Inputs.
- **Kunden-Upload überarbeitet:** `MAX_FILES` 10 → 40. Live-Zähler `N / 40 · noch X möglich` mit Ampel-Farben. Vorab-Limit-Check im Frontend. Drop-Zone vergrößert (`p-10`, w-12 Icon). Voller Modal-Bereich als Fang-Zone (mit fixed Overlay bei Drag-Over). Prominenter „Dateien vom Computer wählen"-Button. Bestehender `compress_image` bleibt aktiv (1920px JPEG Q80).
- **Upload-Fortschritt:** Spinner im Speichern-Button mit Phase „Speichere Daten…" → „Lade N Datei(en) hoch… X%" (axios onUploadProgress). Modal-Close/Abbrechen während Upload gesperrt.
- **KI-Diktat + Korrektur:** Neue `TextareaWithAI`-Komponente kombiniert Whisper-Diktat-Button + Textkorrektur-Modal. Eingebaut in Kunden-Anliegen, Kunden-Notizen, Aufgaben-Beschreibung (Hauptmodul + Quick-Add), Termine-Beschreibung (Hauptmodul + Quick-Add), Projekt-Beschreibung, Projekt-Notizen.
- **Login-UX:** Schlaue Fehlermeldungen statt generischem „Fehler" — unterscheidet 401 (Passwort falsch), Netzwerk-Fehler (Server schläft, 10–20 Sek. warten), 5xx (Server-Fehler), 422 (Validierung). Timeout auf 15 Sek. gesetzt.

## P0 – Morgen zuerst
- **Konflikt-Schutz V1 (Version-Stempel)** für Kunden + Projekte.
  - Felder pro Dokument: `version: int`, `last_modified_by`, `last_modified_at`.
  - Update-Routen prüfen `If-Match` → bei Mismatch HTTP 409 mit aktuellem Zustand.
  - Frontend-Dialog: *„Dieser Datensatz wurde vor 12 Sek. von Frau Müller geändert."* mit `Neu laden` / `Trotzdem überschreiben` / `Abbrechen`.
  - **Entscheidung pending:** Variante A (Kunden + Projekte zusammen) oder B (nur Kunden zuerst, Projekte 1 Tag später).

## P1 – Backlog (im Rahmen Personalisierung)
- **Tageszeit-Begrüßung** im Dashboard („Guten Morgen Ralph", „Mahlzeit", „Guten Abend") + Anrede in Topbar.
- **Startseite nach Login** in Settings konfigurierbar (Dashboard | Aufgaben | Termine | Kunden | Projekte).
- **Interner Team-Chat / Anfrage an Mitarbeiter** (neuer Wunsch): Aus einem Datensatz heraus „Frage an Frau Müller senden" — entweder Chat-Modul (Echtzeit) oder strukturierte Anfrage-Inbox. Vor Implementierung: a/b-Auswahl Echtzeit-Chat vs. Anfrage-Tickets.

## P1 – weiterer Backlog
- Public Contact API (`module_public_api`) gem. `/app/memory/PUBLIC_API_SPEC.md` – braucht Entscheidung Cloudflare Turnstile + Push + UI-Scope.
- Pop-Out-Dialog Phase 2b für Aufgaben + Termine.
- Auto-Portal-Invite nach Mail-Annahme.
- Match-Engine Frontend-Anbindung in Aufgabe/Einsatz/Termin.
- Helle Pastell-Badges in Aufgaben/Einsätze für Dark Mode (`bg-gray-100`/`bg-blue-100` etc. mit `dark:`-Varianten ergänzen).
- Navigation-Berechtigungsfilter wieder aktivieren (aktuell Notfall-deaktiviert).
- Konflikt-Schutz Phase 2: Aufgaben, Termine, Quotes/Orders/Invoices.

## P2 – Future / Vision
- **Sidebar Offen-Indikatoren pro Sub-Sektion** — am aktuell geöffneten Modul ein Mini-Indikator (kleiner Dot) pro Sub-Sektion, ergänzend zu den globalen Sidebar-Zahlen. Aufgenommen am 31.05.2026 16:20 MEZ.
- Umlaut-Fix Migration `module_textvorlagen` (12 Einträge).
- `migrate-thumbnails` Break-Bug bei kleinem `limit`.
- FritzBox Call Monitor.
- N26 CSV Import + Buchhaltung.
- Google Drive Backup (via `integration_playbook_expert_v2`).
- **Vision Phase 2 – KI-gestützte Automatisierung:**
  - Mail-Inbox liest eingehende Anfragen, KI extrahiert Kunde + Anliegen, schlägt Folgeschritte vor.
  - „Vorlagen-Gedächtnis": KI durchsucht alte Angebote/Aufträge nach ähnlichen Bausteinen.
  - Auto-Entwurf-Workflow: aus Anfrage → Entwurf-Angebot → nur noch Freigabe.

## Zugangsdaten Vorschau
- Username: `admin-preview`, Passwort: `HamburgPreview2026!`
