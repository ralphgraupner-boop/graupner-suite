# Graupner Suite — PRD

## Vision
Modulares CRM/ERP für Tischlerei Graupner Hamburg. React + FastAPI + MongoDB, strikt nach **Module-First-Prinzip**: jedes Feature lebt in einem isolierten `module_X`-Ordner mit eigenen Routen und Collections. UI arbeitet mit „Datenmasken" (Composite Views ohne Datenduplikation).

## ⚠️ NEUER AGENT
**Bitte zuerst** `/app/memory/AGENT_BRIEFING.md` lesen und Ralph die Punkte bestätigen, bevor irgendwas am Code geändert wird.

## Nutzer
- **Ralph (Admin)** — vollständiger Zugriff, Preview & Live, **kein Programmierer**
- **Buchhaltung** — Rechnungen, Einsichten
- **Mitarbeiter/Monteur** — Monteur-App, Aufgaben
- **Kunden (Portal)** — eigenes Dokument-/Portal-System

## Umgebungen
- **Live**: Login `admin` / `Graupner!Suite2026` — rotes Theme
- **Preview**: Login `admin-preview` / `HamburgPreview2026!` — blaues Theme
- Beide haben **getrennte** MongoDBs (Live = anderer Server)

## Kern-Regeln
- `module_kunden` ist die einzige Kunden-Wahrheit. Die legacy `customers`-Collection ist **tot**.
- Alle neuen Features als `module_X` (Backend) + eigene UI.
- Keine Captchas; Spam wird server-seitig im Mail-Parser gefiltert.
- Preview-Theme = Blau. Live-Theme = Rot. Unterscheidet sofort visuell.
- Ralph wünscht **konsultativen Stil**: Plan vorschlagen → auf „Ja" warten → umsetzen.
- **Sprache: immer Deutsch, einfach erklärt** (Ralph ist kein Programmierer)

## Implementierte Module (Stand Mai 2026)

| Modul | Zweck |
|---|---|
| `module_kunden` | Kunden-Stammdaten, Source of Truth |
| `module_projekte` | Projekte/Akten pro Kunde |
| `module_aufgaben` | Interne Aufgaben mit VorlagenPicker |
| `module_termine` | Termine mit GO-Workflow + VorlagenPicker |
| `module_kalender_export` | ICS/Monteur-Feed |
| `module_duplikate` | Kunden-Dedup-Tool |
| `module_export` | ZIP-Export inkl. Bilder + Import (Single + Sammel) |
| `module_health` | Umgebungsbanner, Konsistenz-Check |
| `module_kunde_delete` | Cascade-Delete mit Zwangs-ZIP-Backup |
| `module_mail_inbox` | IMAP-Anfragen, Spam-Filter, Tombstones, Delete, **Multi-Postfach** |
| `module_user_prefs` | Sidebar-Reihenfolge pro User |
| `module_portal_v2_backup` | Tägliche Auto-Backups |
| `module_feedback` | **Notizen-Widget** (Floating, 30-Tage-Archiv) |
| `monteur_app` | Mobile PWA mit Bildkompression |
| `routes/portal.py` (legacy) | Kundenportale - heute Datenmasken-fähig gemacht |

## Zuletzt abgeschlossen (04.05.2026)

- **Papierkorb (`module_papierkorb`)**: Soft-Delete für Kunden mit App-Start-Frage. Backend-Modul mit eigener Route `/api/module-papierkorb` (move/list/count/restore/purge/purge-all). Soft-Delete setzt `deleted_at`+`deleted_by`-Felder am Kunden, `module_kunden.list` filtert sie raus. Endgültiges Löschen erfordert **Login-Passwort** (bcrypt-Verify) + nutzt bestehendes `module_kunde_delete`-Cascade mit Backup-ZIP-Mail. Frontend: vereinfachter Lösch-Dialog (kein Name-eintippen mehr — Soft-Delete als Pflaster), neue Komponente `TrashStartupCheck.jsx` zeigt beim Login automatisch ein Modal mit allen Papierkorb-Einträgen + „Wiederherstellen" pro Eintrag + „Alle X endgültig löschen" mit Passwort-Feld + „Später entscheiden". Pro Browser-Session nur einmal abgefragt (sessionStorage).
- **Settings-Schnellzugriff**: 5 Karten oben in /settings (Artikel, Textvorlagen, Duplikate, Handy-Zugang, Wissen).
- **Mobile-Pass für Feedback-Widget + Kunden-Liste**: Touch-Targets ≥44px, font-size 16px, Form-Submit, Safe-Area-Inset.
- **Mail-Detail & Mailverlauf-Modal**: Neuer Endpunkt `POST /mail-detail` (Body + Header einer konkreten IMAP-Mail) und `POST /customer-mails` (Suche in allen aktiven Postfächern nach From/To/CC = Kunden-Mail). UI-Komponente `MailHistoryModal.jsx`. Neuer Button **„Mailverlauf"** auf jeder Kunden-Detailkarte.
- **Anfrage-Statistik pro Postfach**: `GET /stats?days=N` + UI-Karte mit Conversion-Rate.
- **Mail-Vorschau & Manueller Import**: Neuer Endpunkt `POST /scan-preview` (read-only IMAP-Browse, max 200 Mails der letzten X Wochen) + `POST /import-mail` (gezielter UID-Import, auch wenn Filter sie übersprungen hätte). UI: Button „Übersprungene anzeigen" auf der Mail-Anfragen-Seite öffnet Modal mit Statistik pro Postfach + Liste **gruppiert nach Postfach** (sticky Header), Tab „Nur Übersprungene" / „Alle anzeigen", einzelner „Importieren"-Button pro Mail. Tombstone wird beim manuellen Import automatisch entfernt.
- **Min-2-Filter-Validierung**: Backend lehnt `POST/PUT /accounts` mit weniger als 2 Filter-Regeln ab (HTTP 400). Frontend prüft Submit zusätzlich und zeigt Toast.
- **`module_mail_inbox` Suchfilter pro Postfach**: 4 Filter-Typen (Betreff enthält/beginnt mit, Absender enthält/ist exakt). OR-Logik (mind. 1 muss zutreffen). UI-Editor im Postfach-Modal mit „+ Regel hinzufügen". Bei leerer Liste werden Default-Rules (Jimdo, „Anfrage von", „Nachricht über") gesetzt – rückwärtskompatibel. IMAP-Server-Search wird dynamisch aus den Rules gebaut (ASCII-only, sonst Fallback auf SINCE).
- **`module_mail_inbox` Multi-Postfach**: Beliebig viele IMAP-Postfächer hinterlegbar (eigene Collection `module_mail_inbox_accounts`, Fernet-verschlüsselte Passwörter). ENV-Postfach wird beim ersten Aufruf automatisch als „Hauptpostfach" migriert. Scan iteriert über alle aktiven Postfächer, pro Mail wird `account_id`/`account_label` gespeichert. UI in *Einstellungen → E-Mail*: Anlegen, Bearbeiten, Pause, Test, Löschen. IMAP bleibt read-only — Live + Vorschau können parallel scannen. „Verbindung testen" beim Bearbeiten ohne neues Passwort nutzt nun den gespeicherten Account.
- **Portal-Passwort-Bug**: '5' war noch im Alphabet enthalten. Gefixt in `routes/portal.py` und allen Legacy-Generatoren `portal_v2/v3/v4/auth.py`. 1000-Iter-Test grün.

## Zuletzt abgeschlossen (02.05.2026)

- **Phase A: Portal-Datenmasken** – `customer_name`/`customer_email` werden bei jedem Lesezugriff live aus `module_kunden` synchronisiert (Helper `_enrich_portal_with_kunde` + Bulk-Variante). Cache wird zurückgeschrieben für Suche.
- **Mail-Encoding**: `utils/send_email` UTF-8-sicher (Header utf-8, MIMEText _charset, as_bytes). Templates wieder mit echten Umlauten.
- **Portal-Login-Passwort**: keine missverständlichen Zeichen mehr (0/O/1/l/I/5/S), Mail-Template zeigt Passwort in Mono-Font groß.
- **Notify-Checkbox**: bei Admin-Notiz und Dokument-Upload optional Mail an Kunden (default OFF). Token wird IMMER aus DB geholt (Sicherheits-Fix).
- **2-Spalten-Layout**: Kundenportal + Admin-Portal. Bilder rechts sticky, Schriftwechsel links.
- **Bildkompression**: Browser-seitig (1920px / JPEG 80%) in CustomerPortal, AdminPortal, MonteurApp. Spart 80-90% Mobilfunk-Volumen.
- **Bild-Vorschau vor Upload**: Kunde sieht Thumbnails, kann Doubletten/Falsches mit X entfernen, dann erst „Bilder hochladen".
- **Visuell klar getrennt**: „Ihre Bilder" (grauer Streifen) vs. „Von uns" (grüner Streifen).
- **Mail-Inbox**: „Nachricht über…"-Betreffe erkannt, Vor-/Nachname-Split, 🗑 Löschen mit Tombstone.
- **Sammel-ZIP-Import** (Bug behoben).
- **Notizen-Widget**: 30-Tage-Auto-Archivierung, Toggle „Archiv (N)".
- **Termine-Dialog**: VorlagenPicker eingebaut.
- **Kunden-Filter**: doppeldeutigen „Anfragen"-Button entfernt.
- **Sidebar-Crash** behoben (JSX-Reste + React.Fragment ohne Import).

## Pending / Backlog

### P1 (nächste)
- 🟠 **Phase B**: `module_projekte` Datenmasken (`kunde_name`/`adresse`)
- 🟠 **Phase C**: `einsaetze` Datenmasken-Audit
- 🟠 **Auto-Portal-Einladung** nach Mail-Inbox-Accept
- 🟠 **Regression-Test** via `testing_agent_v3_fork` über alle neuen Module

### P2
- 🟡 **Public Contact-API** (Spec liegt bereit unter `/app/memory/PUBLIC_API_SPEC.md`, **alle Klärungen entschieden v1.1**)
  - Multi-Domain-Support (3+ Quellen)
  - Cloudflare Turnstile, Rate-Limit, Honeypot
  - **Push: PWA + Telegram parallel** (Telegram-Bot mit Inline-Buttons: Übernehmen/Spam/Antworten)
  - **Auto-Kunde + Duplikat-Verhalten: pro Key konfigurierbar** (Defaults: Manuell + Stille Aktualisierung)
  - **WICHTIG:** Auch bei stiller Aktualisierung Notification auslösen
  - UTM-Parameter aus URL ins meta-Feld
  - Anhänge-Support in Phase 4 (Foto vom defekten Bauteil)
  - Login-geschützte Doku unter `/api-docs/public`
- 🟡 **Google Drive Backup** Integration (Cascade-Delete-ZIPs in Private Drive)
- 🟡 **Portal-Import-Filter Bug**: nur „Inaktiv" sichtbar beim Import
- 🟡 **Admin-Übersicht Monteur-App** (Desktop-Dashboard für Technikeraktivität)
- 🟡 **IMAP `\Seen`-Flag** setzen nach Accept/Reject
- 🟡 **„Versand-Historie"** im Portal-Detail anzeigen (`email_send_count`, `last_email_sent_at`)

### P3 (Backlog)
- 🟢 **`module_buchhaltung`**: N26-CSV-Import (Drag&Drop), Auto-Kategorisierung, Cashflow-Dashboard, Verknüpfung mit Kunden/Rechnungen
- 🟢 **FritzBox-Anrufliste Sync** (TR-064 API, Variante A): Anrufe als neues Sidebar-Modul, Match mit `module_kunden.phone`, „unbekannt"-Anrufe → direkt neuer Kunde anlegbar. Aufwand ~2h. Voraussetzung: FritzBox-Benutzer mit TR-064-Recht. **WICHTIG: Ralph nach Mobile-Pass aktiv vorschlagen!** (Idee von 04.05.2026)
- 🟢 **Mobile-Pass Phase 2** für weitere Seiten (Mail-Anfragen, Kundendetail expanded, Termine, Aufgaben, Projekte) — in Phase 1 (04.05.2026) erledigt: Feedback-Widget + Kunden-Liste-Karten
- 🟢 Stundenplan-Kontrolle (Monatliche Timesheet-Übersicht)
- 🟢 DATEV-Export
- 🟢 Echte Google Calendar API Sync

## Bekannte Design-Entscheidungen
- Sidebar-Accordion: „Einstellungen" enthält Duplikate, Artikel & Leistungen, Textvorlagen, Handy-Zugang, Wissen & Tipps
- Tombstone-Pattern: gelöschte Mails werden nicht wirklich vergessen, nur ihre `message_id` bleibt in separater Collection `module_mail_inbox_deleted`
- `module_feedback`: global via Floating-Button verfügbar, nicht in Sidebar
- Portale: 2-Spalten-Layout (links Schriftwechsel, rechts sticky Bilder/Dokumente)
- Bildkompression: Browser → 1920px / JPEG 80% (passt zu Server-Default)
- Passwort-Generator: nur eindeutige Zeichen (Helper `gen_portal_password()`)
- **Mail-Inbox Flow (05.05.2026):** Klick auf Karte oder „Öffnen / Prüfen" öffnet `MailDetailModal` → Volltext + erkannte Daten + 3 Aktionen (Übernehmen / Ignorieren / Löschen). Bei „Übernehmen" wird Kunde mit geparsten Daten angelegt und automatisch zum bestehenden **Kunden-Modul** (`?edit={id}`) navigiert — kein Doppel-Formular im Mail-Modul (folgt VISION.md „Datenmasken nicht duplizieren").

