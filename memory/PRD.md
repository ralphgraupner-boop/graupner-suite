# PRD — Graupner Suite (Tischlerei-CRM)

> Modulares, mobil-freundliches CRM für eine Tischlerei.
> Stand: 16.05.2026 (Fork-Resume)

## Architekturregeln (Pflicht)
1. Keine hartcodierten Auswahllisten – live aus `module_textvorlagen`.
2. Keine neuen Module für Auswahlfelder – via `doc_type` in `module_textvorlagen`.
3. Daten nicht duplizieren – `kunde_name`/`adresse` immer live joinen.
4. Keine neuen Dateien in `routes/` – nur `module_<name>/routes.py`.
5. Vor Architektur-Entscheidungen IMMER a/b/c-Optionen vorschlagen und auf "Ja" warten.

## Stack
- Frontend: React + Tailwind + Shadcn UI, BroadcastChannel, Custom WindowManager.
- Backend: FastAPI + MongoDB, Module-First Layout.
- LLM: OpenAI GPT-5.2 + Whisper via Emergent LLM Key (LiteLLM).
- PDFs: `reportlab` über `backend/utils/pdf_generator.py`.

## Was zuletzt erledigt wurde
- 16.05.2026: PDF Briefkopf-Konstanten (HEADER_FIRMA_*, HEADER_SEIT_*, HEADER_RECHTS_*, HEADER_ABSTAND_ANGEBOTSNR) in `pdf_generator.py`. Briefkopf-Farben & Schriftgrößen jetzt zentral. Angebots-Nr-Block um 8 mm tiefer gerückt (FIX 2 + FIX 3). Verifiziert via Test-PDF + Bildanalyse.
- 16.05.2026: FIX 1 – Zeilenumbruch/Textbreite für Fließtext: `body_margin_left = 1.5 cm`, `body_wrap_width = width - 3.0 cm`. `<p>` als Absatz, `<br>` als Leerzeichen.
- SettingsPage.jsx (2841 Z.) in 8 Tab-Files aufgeteilt + Dead-Tabs archiviert.
- `module_mail_inbox/routes.py` (1354 Z.) in 5 Sub-Router aufgeteilt.
- Datenmasken für `module_projekte` und `module_einsaetze` (kunde_name aus DB entfernt, Migration auf Live).
- `module_assistent` Scheduler + UI mit 5 Check-Routinen.
- Kundenportal Desktop-Layout 50/50, `max-w-7xl`, größere Bilder.
- `imageCompress.js` triggert erst > 1 MB, 2560 px @ 0.92.
- Sidebar "NEU"-Badges via `/count-neu`, `/count-offen` dynamisch.

## P0 – Direkt offen
- (keine, PDF-Block abgeschlossen)

## P1 – Backlog
- Public Contact API (`module_public_api`) gem. `/app/memory/PUBLIC_API_SPEC.md` – braucht Entscheidung Cloudflare Turnstile + Push + UI-Scope.
- Pop-Out-Dialog Phase 2b für Aufgaben + Termine.
- Auto-Portal-Invite nach Mail-Annahme.
- Match-Engine Frontend-Anbindung in Aufgabe/Einsatz/Termin.

## P2 – Future
- Umlaut-Fix Migration `module_textvorlagen` (12 Einträge).
- `migrate-thumbnails` Break-Bug bei kleinem `limit`.
- FritzBox Call Monitor.
- N26 CSV Import + Buchhaltung.
- Google Drive Backup (via `integration_playbook_expert_v2`).

## Zugangsdaten Vorschau
- Username: `admin-preview`, Passwort: `HamburgPreview2026!`
