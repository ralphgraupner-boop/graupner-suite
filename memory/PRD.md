# Graupner Suite – Product Requirements (PRD)

**Projekt:** Graupner Suite – Handwerker-Verwaltungssoftware für Tischlerei R. Graupner (Hamburg)
**Prinzip:** **Module-First** — jedes Modul ist eigenständig (eigene Routes + Collections + Feature-Flag).
**Live:** https://code-import-flow-1.emergent.host
**Preview:** https://handwerk-deploy.preview.emergentagent.com
**Sprache der Antworten:** STRIKT **Deutsch**.

---

## 🚨 ABSOLUTE REGELN — vom User mehrfach geschärft

### 1. Vor JEDER Änderung Plan vorlegen + auf "Ja" warten
Der User hat in der Vergangenheit Daten verloren durch ungebetene Aktionen. **Niemals** ohne Bestätigung:
- Module anrühren oder erweitern
- Felder im Backend ändern
- DB schreiben (außer trivialen Test-Inserts mit sofortigem Cleanup)
- Git-Aktionen (rm, branch, etc.)
- Mass-Datei-Refactorings

**OK ohne Frage**: Tippfehler, Lint-Fixes, kleinste Bugfixes die er selbst angefragt hat.

### 2. Module-First — vom User wörtlich:
> "Wir programmieren grundsätzlich Module – Datenmasken (leicht zu kontrollieren und veränderbar)."
> "Datenmasken bedienen sich aus den jeweiligen zuständigen Modulen, welche Daten zur Verfügung stellen."

Konkret:
- ✅ Neuer Ordner `/app/backend/<modulname>/` mit eigenem Router + eigenen Collections (`module_*`)
- ✅ Eigenes API-Prefix
- ✅ Feature-Flag in eigener Settings-Collection
- ✅ Erlaubte Core-Änderungen: nur 1 `include_router` in `server.py`, 1 Sidebar-Eintrag in `Navigation.jsx`, 1–2 Routes in `App.js`
- ✅ Datenmasken referenzieren per ID, **kein** Daten-Kopieren zwischen Modulen
- ✅ Bei jedem neuen Modul: Eintrag in `auto_backup.py` Collections-Liste + Diverses-Anleitung anlegen

### 3. User-Sprache & Kontext
- **Deutsch** ist Pflicht für alle Antworten
- User ist in **Hamburg, Deutschland** (CEST, UTC+2)
- User nutzt **Betterbird** (NICHT Outlook!) — niemals "Outlook" sagen
- Server läuft auf UTC, im Frontend wird Hamburg-Zeit angezeigt (kommende Aufgabe)

### 4. Verboten
- ❌ Änderungen an `utils/__init__.py` (SMTP-Kern), `WysiwygDocumentEditor.jsx`, `routes/portal.py` Logik, `routes/webhook.py`, `DashboardPage.jsx`
- ❌ Mass-DB-Schreiben ohne Schritt-für-Schritt-User-Zustimmung
- ❌ Mock-Daten in den Live-Collections

---

## 🔐 Login-Credentials (siehe auch `/app/memory/test_credentials.md`)

| Wo | Username | Passwort |
|---|---|---|
| **Live** (`code-import-flow-1.emergent.host`) | `admin` | `Graupner!Suite2026` |
| **Preview** (`handwerk-deploy.preview.emergentagent.com`) | `admin-preview` | `HamburgPreview2026!` |

⚠️ Beide nutzen dieselbe DB. Der zweite User wurde am 27.04.2026 angelegt, damit Chrome-Autofill nicht durcheinander kommt.

---

## 📦 Modul-Stand 27.04.2026

| Modul | Zweck | Status |
|---|---|---|
| `module_kunden` | Stammdaten Kunde (inkl. Anfragen) | ✅ |
| `module_projekte` | Kundenprojekte (Werkbank-Datenmaske) | ✅ |
| `module_aufgaben` | Interne+kontextuelle Aufgaben (`kunde_id`/`projekt_id`) | ✅ |
| `module_termine` | Termine mit GO-Workflow + Datenmaske `/enrich` | ✅ |
| `module_kalender_export` | ICS-Mail-Versand (RFC 5545) + Monteur-Feed-Abo | ✅ NEU 27.04.2026 |
| `module_user_prefs` | UI-Präferenzen (Sidebar-Reihenfolge, drag&drop) | ✅ |
| `module_duplikate` | Duplikat-Erkennung & Merge | ✅ |
| `module_textvorlagen` | Textbausteine (`doc_type` getypt) | ✅ |
| `dokumente_v2` | GoBD-Dokumente Phase 1-4 | ✅ |
| `monteur_app` | Datenmaske: Einsatz + Kunde, 3 Tabs (Einsätze/Termine/Aufgaben) | ✅ erweitert |
| `module_portal_v2_backup` | Portal-v2-Snapshots | ✅ |
| `portal_klon` | 1:1 Sandbox-Kopie von `/portals` | ✅ |
| `portals` (legacy) | Aktiv genutztes Kundenportal | ✅ User-Präferenz |
| `einsaetze` | Kern-Einsatzmodul (Termine als Felder) | ✅ |
| **TODO** `module_google_kalender` | Echter API-Sync (OAuth) | ❌ optional, falls ICS nicht reicht |
| **TODO** `module_arbeitsanweisungen` | Klärung offen: eigenes Modul oder Textvorlagen-Erweiterung? | ❌ |

---

## 🎯 LETZTER STAND (27.04.2026 ~16:40 UTC)

### Was zuletzt fertig wurde
- **`module_kalender_export`** komplett gebaut + getestet:
  - Endpoints: `/preview-recipients`, `/preview-ics`, `/send`, `/log`, `/feed-info/<user>`, `/feed-info/<user>/regenerate`, `/feed/<user>/<token>.ics`
  - ICS-Generator (RFC 5545 valide, eigene `ics_generator.py`, keine externen Libs)
  - Audit-Log (`module_kalender_export_log`)
  - Monteur-Feed mit Token-Schutz (`module_kalender_feed_tokens`)
  - Frontend `TerminSendDialog.jsx` mit Empfänger-Auswahl (Sachbearbeiter, Mitarbeiter Multi, Kunde, externe Mails)
  - Eingebaut in `/module/termine` und in `TerminePanel`-Komponente
- **AufgabenPanel + TerminePanel überall verteilt**:
  - Kunden-Detail (`KundenModulPage`) ✅
  - Projekt-Werkbank Kunden-Ebene ✅
  - Projekt-Werkbank Projekt-Ebene ✅
  - Portal-Detail (`PortalsPage`) ✅ NEU 27.04.
  - Portal-Klon-Detail (`PortalsKlonPage`) ✅ NEU 27.04.
  - Anfragen sind = `module_kunden` mit Status "Anfrage" → automatisch via Kunden-Detail abgedeckt
- **Live-Test ICS-Mail**: ✅ erfolgreich an `Ralph.graupner@tischlerei-graupner.de`, User bestätigte „hat funktioniert"
- **Zweiter Admin-User `admin-preview`** angelegt (für Browser-Autofill-Trennung)
- **Sidebar Drag&Drop** + DB-persistierte Reihenfolge (`module_user_prefs`)
- **Backup-Liste** in `auto_backup.py` erweitert um alle neuen Collections
- **Diverses-Einträge** als Auto-Anleitung angelegt (5 Stück, sort_order 1-5)

### Was als NÄCHSTES dran ist (User-Aussage: "morgen genau hier weiter")
User stand vor 3 Optionen, hat noch nicht gewählt, bevor er zur Besichtigung musste:

> **a)** Live-Test ICS-Mail in Betterbird öffnen → sehen ob Klick "Annehmen" den Termin **automatisch in seinen Google-Kalender** überträgt (wenn Betterbird-Lightning-Sync mit Google-Konto eingerichtet ist).
> 
> **b)** **Monteur-Abo-URL** ausprobieren — `GET /api/module-kalender-export/feed-info/admin` liefert eine persönliche `.ics`-Feed-URL. Diese einmal in Google-Kalender unter "Weitere Kalender > Per URL hinzufügen" eintragen → ALLE seine zugewiesenen Termine erscheinen automatisch (5-Min-Cache), auch auf dem Smartphone.
> 
> **c)** **Echtes `module_google_kalender` bauen** mit OAuth/Service-Account → API-Sync ohne Mail-Klick. Aufwendiger, braucht Google-Cloud-Setup vom User.

**EMPFEHLUNG für nächsten Agent**: 
1. User begrüßen mit „Bin noch hier" oder „Bin neu, hier ist der Stand…"
2. Frage erneut stellen: a, b oder c?
3. Empfehle b zuerst (Abo-URL) — schnellster Win, kein Setup nötig.
4. Wenn b funktioniert → c eventuell überflüssig.

---

## 📂 Wichtige Code-Pfade

### Backend
- `/app/backend/server.py` (Router-Includes Z.46–110, neue: Z.114-116)
- `/app/backend/module_aufgaben/routes.py` (CRUD + `kunde_id`/`projekt_id` Filter)
- `/app/backend/module_termine/routes.py` (CRUD + GO-Workflow + `/enrich/{id}` Datenmaske)
- `/app/backend/module_kalender_export/routes.py` (ICS-Mail + Feed)
- `/app/backend/module_kalender_export/ics_generator.py` (RFC 5545 Builder)
- `/app/backend/module_user_prefs/routes.py` (sidebar_order GET/PUT/DELETE)
- `/app/backend/routes/auto_backup.py` (Backup-Liste – bei NEUEN Modulen IMMER hier ergänzen!)
- `/app/backend/routes/portal.py` — TABU, nicht anfassen

### Frontend
- `/app/frontend/src/components/AufgabenPanel.jsx` (reusable, kunde_id ODER projekt_id)
- `/app/frontend/src/components/TerminePanel.jsx` (reusable, mit GO + ICS-Send-Dialog)
- `/app/frontend/src/components/TerminSendDialog.jsx` (ICS-Empfänger-Auswahl)
- `/app/frontend/src/components/layout/Navigation.jsx` (Sidebar mit Drag&Drop, Polling für termine_go-Badge)
- `/app/frontend/src/pages/KundenModulPage.jsx` (Kunde-Detail mit Panels)
- `/app/frontend/src/pages/projekte/ProjektWerkbank.jsx` (Werkbank mit Panels auf 2 Ebenen)
- `/app/frontend/src/pages/PortalsPage.jsx` (Legacy Portal mit Panels)
- `/app/frontend/src/pages/PortalsKlonPage.jsx` (Klon-Sandbox mit Panels)
- `/app/frontend/src/pages/termine/ModuleTerminePage.jsx` (Hauptseite Termine)
- `/app/frontend/src/pages/aufgaben/ModuleAufgabenPage.jsx` (Hauptseite Aufgaben)
- `/app/frontend/src/pages/monteur_app/MonteurAppPage.jsx` (3 Tabs: Einsätze/Termine/Aufgaben)

---

## 🔌 Wichtige API-Endpunkte

### Termine
- `POST /api/module-termine` (anlegen, Status `wartet_auf_go`)
- `PATCH /api/module-termine/{id}/go` → `bestaetigt`
- `PATCH /api/module-termine/{id}/cancel` mit `{grund}`
- `PATCH /api/module-termine/{id}/mark-im-kalender` (intern aufgerufen)
- `GET /api/module-termine?kunde_id=X` / `?projekt_id=X` / `?monteur_username=X`
- `GET /api/module-termine/{id}/enrich` — Datenmaske: joint kunde+projekt+aufgabe+monteur
- `GET /api/module-termine/wartet-auf-go` (Sidebar-Badge)

### Kalender-Export
- `GET /api/module-kalender-export/termin/{id}/preview-recipients`
- `GET /api/module-kalender-export/termin/{id}/preview-ics` (Download)
- `POST /api/module-kalender-export/termin/{id}/send` mit `{sachbearbeiter, mitarbeiter_usernames, auch_kunde, externe_mails}`
- `GET /api/module-kalender-export/termin/{id}/log` (Audit)
- `GET /api/module-kalender-export/feed-info/<username>` (Abo-URL holen)
- `POST /api/module-kalender-export/feed-info/<username>/regenerate` (Token erneuern)
- `GET /api/module-kalender-export/feed/<user>/<token>.ics` (öffentlich, Token-Schutz)

### Aufgaben
- Standard CRUD `/api/module-aufgaben`
- `PATCH /api/module-aufgaben/{id}/status`
- Filter: `?kunde_id=`, `?projekt_id=`, `?zugewiesen_an=`, `?status=`, `?kategorie=`
- `GET /api/module-aufgaben/mitarbeiter` (User-Liste für Zuweisung)

### User-Prefs
- `GET /api/module-user-prefs/me`
- `PUT /api/module-user-prefs/me` mit `{sidebar_order: [...]}`
- `DELETE /api/module-user-prefs/me` (Reset)

### Backup
- `POST /api/backup/auto/trigger` (manueller Trigger, sendet Mail)

---

## 🗂 Auto-Backup-Liste

In `/app/backend/routes/auto_backup.py` Zeile ~14-46.
**REGEL:** Bei JEDEM neuen Modul mit Collections diese Liste ergänzen, sonst sind die Daten nicht im täglichen Backup!

Aktuell drin (vollständig):
- Alle module_* (kunden, projekte, aufgaben, termine, duplikate, user_prefs, kalender_export_log, kalender_feed_tokens, etc.)
- Settings-Collections (module_*_settings)
- monteur_app_* (notizen, fotos, todos, feedback, settings)
- dokumente_v2 + Counter-Logs
- Portal v2/v3/v4 + portal_klon
- Legacy: customers, quotes, orders, invoices, articles, rechnungen_v2, etc.

---

## 📚 Diverses-Einträge (vom User gewünschtes Auto-Doku-System)

User hat explizit gefordert: bei jeder neuen Funktion **automatisch** einen Eintrag in `/api/diverses` mit `kategorie="Anweisungen"`, `wichtig=true` anlegen. Bisher angelegt (sort_order 1-5):

1. „Aufgaben & Termine in der Monteur-App – wo eingeben?"
2. „Aufgaben direkt im Kunden / Projekt anlegen"
3. „Tägliches Auto-Backup – Was wird gesichert & wie wiederherstellen"
4. „Sidebar-Reihenfolge selbst anpassen"
5. „Termin-Versand: ICS-Mail an Sachbearbeiter / Mitarbeiter / Kunde"

**TODO**: Eintrag „Aufgaben + Termine sind jetzt überall (Kunde/Projekt/Portal/Anfragen)" — habe ich noch nicht angelegt, weil User noch nicht „ja" sagte. Beim nächsten Agent fragen.

---

## 📝 Session 2026-04-29 Änderungen

### Bearbeiten in Kunden/Projekten/Portalen
- **AufgabenPanel** & **TerminePanel**: Pencil-Icon → öffnet bestehenden Dialog im Edit-Modus (PUT statt POST). Status-Feld im Aufgaben-Edit ergänzt. Datetime-Konvertierung im Termin-Edit. Beide Quick-Dialoge auf `max-w-2xl` vergrößert.
- Hot-Reload-Glitch: Pencil-Import nachgezogen.

### NEU: module_export – Kunden-ZIP-Export & Re-Import
- Backend: `/app/backend/module_export/` (Module-First, eigenes Prefix `/api/module-export`)
  - `GET /preview/{kunde_id}` — Übersicht: Projekte/Aufgaben/Termine/Einsätze/Quotes/Rechnungen/Portale/Uploads/Aktivität/Monteur/Files
  - `GET /kunde/{kunde_id}/zip` — komplettes ZIP (manifest.json + JSON je Datentyp + `files/`-Ordner mit Originaldateien aus Object-Storage)
  - `GET /alle/zip` — sammelt alle Kunden in einem Master-ZIP (Backup-Use-Case)
  - `POST /import` — ZIP wieder einlesen, Modi `new_ids` (Default, sicher) oder `overwrite`
  - `GET /log` — Audit-Log (`module_export_log`)
- Frontend:
  - `KundeExportButton.jsx` — Preview-Dialog + ZIP-Download im Kunden-Detail
  - `KundeImportButton.jsx` — ZIP-Upload + Modus-Auswahl + Ergebnis-Report, oben in Kundenliste
- Auto-Backup: `module_export_log` aufgenommen
- Tests via curl: Round-Trip (Export → Import mit `new_ids` → Cleanup) erfolgreich

### Offen / Verifizierung
- Cascade-Delete (Baustein 1) noch nicht implementiert — User muss erst Export-Funktion live testen, dann entscheiden wir ob wir Hard-Delete mit Vorab-Export-Pflicht oder Soft-Delete machen.

---

## 📝 Session 2026-04-28 Änderungen

- **VorlagenPicker UI vergrößert** (User-Feedback "fenster ist zu klein"):
  - Dropdown: `w-[min(90vw,520px)]`, `max-h-[70vh]`, rechtsbündig mit Backdrop-Close.
  - Einträge: Titel `text-sm font-semibold`, Beschreibung 2-zeilig (180 Zeichen statt 60, line-clamp-2).
  - Aufgaben-Dialog (`ModuleAufgabenPage.jsx`) & Quick-Create-Dialog (`AufgabenPanel.jsx`): `max-w-md/lg` → `max-w-2xl` (672px).
- **Offen**: VorlagenPicker in Termine-Dialog (doc_type="termin") einbauen – auf User-Freigabe wartend.

---

## ⚠️ User-Wahrnehmungen / Sensitivitäten

- User merkt SOFORT, wenn das Programm-Verhalten nicht zu seiner mentalen Vorstellung passt. Beispiele:
  - Hat heute korrekt bemerkt, dass nach Aufgaben+Termine-Bau das **Portal** noch fehlte → eingefordert
  - Hat korrekt bemerkt, dass Outlook ≠ Betterbird
  - Hat korrekt bemerkt, dass Hamburg-Zeit ≠ UTC
- User hat in der Vergangenheit **viel Ärger und Datenverlust** mit Emergent-Agents gehabt, ist deshalb sehr vorsichtig. Geduld + Transparenz priorisieren.
- User mag **kurze, klare Antworten** mit konkreten Optionen (a/b/c-Style). Lange Erklärungen ohne Aktion sind nicht hilfreich.

---

## 🚦 Backlog / Future

| Priorität | Aufgabe |
|---|---|
| P1 | User-Entscheidung a/b/c zu Google-Kalender (siehe oben) |
| P1 | Bug Portal-Import-Filter live mit User reproduzieren (zu wenig "Inaktive" sichtbar — DB war zwischenzeitlich leer) |
| P2 | Klärungsfrage `module_arbeitsanweisungen` (eigenes Modul vs. Textvorlagen-Erweiterung) |
| P2 | Hamburg-Zeit zentral im Frontend statt UTC anzeigen |
| P2 | Refactoring `routes/auto_backup.py` → `module_backup` (Module-First) |
| P2 | Admin-Übersicht Monteur-Tagesdoku |
| P2 | Mobile Bildkompression Monteur-App |
| P3 | DATEV-Export |
| P3 | Stundenplan-Kontrolle (User liefert PDF-Beispiel) |
| P3 | Re-Eval ob `einsaetze` durch neue Modul-Architektur ersetzbar |

---

## 💡 Tipp für den nächsten Agent

Der erste Satz an den User wenn du neu bist:
> „Hi Ralph, ich bin ein neuer Agent — die letzte Session ist beendet. Ich habe den Handoff gelesen und bin auf dem aktuellen Stand: ICS-Test war gestern erfolgreich, du wolltest noch zwischen a/b/c entscheiden (Google-Kalender-Sync). Welche Option?"

Wenn du **derselbe** Agent bist:
> „Bin noch hier, gleicher Agent. Du wolltest noch a/b/c zu Google-Kalender entscheiden. Welche?"
