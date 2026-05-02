# Graupner Suite — PRD

## Vision
Modulares CRM/ERP für Tischlerei Graupner Hamburg. React + FastAPI + MongoDB, strikt nach **Module-First-Prinzip**: jedes Feature lebt in einem isolierten `module_X`-Ordner mit eigenen Routen und Collections. UI arbeitet mit „Datenmasken" (Composite Views ohne Datenduplikation).

## Nutzer
- **Ralph (Admin)** — vollständiger Zugriff, Preview & Live
- **Buchhaltung** — Rechnungen, Einsichten
- **Mitarbeiter/Monteur** — Monteur-App, Aufgaben
- **Kunden (Portal)** — eigenes Dokument-/Portal-System

## Umgebungen
- **Live**: Login `admin` / `Graupner!Suite2026` — rotes Theme
- **Preview**: Login `admin-preview` / `HamburgPreview2026!` — blaues Theme
- Beide teilen aktuell dieselbe MongoDB.

## Kern-Regeln
- `module_kunden` ist die einzige Kunden-Wahrheit. Die legacy `customers`-Collection ist **tot**.
- Alle neuen Features als `module_X` (Backend) + eigene UI.
- Keine Captchas; Spam wird server-seitig im Mail-Parser gefiltert.
- Preview-Theme = Blau. Live-Theme = Rot. Unterscheidet sofort visuell.
- Ralph wünscht **konsultativen Stil**: Plan vorschlagen → auf „Ja" warten → umsetzen.

## Implementierte Module (Feb 2026)

| Modul | Zweck |
|---|---|
| `module_kunden` | Kunden-Stammdaten, Source of Truth |
| `module_projekte` | Projekte/Akten pro Kunde |
| `module_aufgaben` | Interne Aufgaben mit VorlagenPicker |
| `module_termine` | Termine mit GO-Workflow |
| `module_kalender_export` | ICS/Monteur-Feed |
| `module_duplikate` | Kunden-Dedup-Tool |
| `module_export` | ZIP-Export inkl. Bilder + Import |
| `module_health` | Umgebungsbanner, Konsistenz-Check |
| `module_kunde_delete` | Cascade-Delete mit Zwangs-ZIP-Backup |
| `module_mail_inbox` | IMAP-Anfragen, Spam-Filter, Tombstones |
| `module_user_prefs` | Sidebar-Reihenfolge pro User |
| `module_portal_v2_backup` | Tägliche Auto-Backups |
| `module_feedback` | Persönliche Notizen/Bugs (Floating Widget) |
| `monteur_app` | Mobile PWA |

## Zuletzt abgeschlossen (Mai 2026)

- **02.05.2026** – `module_feedback` neu: Floating-Widget rechts unten, Quick-Add, Typ/Prio/Status, auf jeder Seite verfügbar. Agent kann beim Session-Start die Liste per API lesen und abarbeiten.
- **02.05.2026** – `module_mail_inbox` um `DELETE`-Endpoint + Tombstone-Collection erweitert. Einträge (Testmails/Spam) können endgültig gelöscht werden und kommen beim Re-Scan nicht zurück.
- **02.05.2026** – IMAP-Scan erkennt jetzt Jimdo-Betreffe `"Nachricht über https://..."` (ASCII-sicher via Subject-Token `tischlerei-graupner`), Parser splittet Vor-/Nachname korrekt auch wenn `Frau Herr:` nur die Anrede enthält.
- **02.05.2026** – Fix: `Navigation.jsx` JSX-SyntaxError (verunfallter Export am Dateiende) + `React.Fragment`→`Fragment` (nicht importiert) behoben; Sidebar-Accordion unter „Einstellungen" funktioniert.

## Pending / Backlog

### P1 (nächste)
- **VorlagenPicker** im Termine-Dialog (Parität zu Aufgaben)
- **Auto-Portal-Einladung** nach Accept im `module_mail_inbox`
- **Regression-Test** via `testing_agent_v3_fork` über die 4 neuen Module (Export, Health, Delete, Mail-Inbox) — bisher nur manuell getestet

### P2
- **Google Drive Backup** Integration (Cascade-Delete-ZIPs in Private Drive)
- **Portal-Import-Filter Bug**: nur „Inaktiv" sichtbar beim Import
- **Admin-Übersicht Monteur-App** (Desktop-Dashboard für Technikeraktivität)
- **Mobile Bild-Kompression** in Monteur-App vor Upload
- **Mail-Inbox** IMAP `\Seen`-Flag setzen, damit Mails im Postfach nicht weiter „ungelesen" bleiben

### P3
- Stundenplan-Kontrolle (Monatliche Timesheet-Übersicht)
- DATEV-Export
- Echte Google Calendar API Sync

## Bekannte Design-Entscheidungen
- Sidebar-Accordion: „Einstellungen" enthält Duplikate, Artikel & Leistungen, Textvorlagen, Handy-Zugang, Wissen & Tipps
- Tombstone-Pattern: gelöschte Mails werden nicht wirklich vergessen, nur ihre `message_id` bleibt in separater Collection `module_mail_inbox_deleted`
- `module_feedback`: global via Floating-Button verfügbar, nicht in Sidebar
