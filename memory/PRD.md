# PRD — Graupner Suite (Tischlerei-CRM)

> Modulares, mobil-freundliches CRM für eine Tischlerei.
> Stand: 22.05.2026

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
