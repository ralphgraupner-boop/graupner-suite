# PRD — Graupner Suite (Tischlerei-CRM)

> Modulares, mobil-freundliches CRM für eine Tischlerei.
> Stand: 31.05.2026

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
