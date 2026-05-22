# PRD — Graupner Suite (Tischlerei-CRM)

> Modulares, mobil-freundliches CRM für eine Tischlerei.
> Stand: 22.05.2026

## Update 22.05.2026 — Phase 1 Rollen-Konzept verifiziert + Login-Redirect nachgezogen
- **Backend Admin-Härtung** (8/8 Curl-Tests grün): 18 Endpunkte in 6 Routern (Backup, IMAP, Text-Templates, Leistungsblöcke, Services, Diverses) sind via `Depends(require_admin)` aus `backend/security/admin_check.py` geschützt. Non-Admin → 403, Admin → 200, ohne Token → 401. Alle Lints sauber.
- **Login-Redirect (Phase 1 Frontend)**: In `frontend/src/App.js` Zeile 73 `defaultPage` dynamisch aus `getUserRole()` abgeleitet. Logik: `role === "monteur" || role === "mitarbeiter"` → `/monteur`, sonst `/dashboard`. Auswahl iii+b+x: greift heute schon für `mitarbeiter` (Heike), und automatisch später für `monteur` (Phase 2). Verifiziert: admin-preview → `/dashboard`, Heike Bolanka → `/monteur`.

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
