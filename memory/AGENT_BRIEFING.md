# 🛑 PFLICHTLEKTÜRE FÜR DEN NÄCHSTEN AGENTEN

> **Stand:** 02.05.2026, 19:15 Uhr · Vereinbart mit Ralph Graupner
>
> **WICHTIG:** Bevor du irgendeine Aufgabe annimmst oder Code änderst,
> bestätige Ralph diese Punkte **wörtlich**. Erst dann darfst du loslegen.

---

## 🤝 1. KOMMUNIKATIONS-REGELN

- **Sprache:** Immer **Deutsch**, in einfacher Sprache. Ralph ist **kein Programmierer**.
- **Konsultativer Stil:** Plan vorschlagen → auf "Ja" warten → erst dann coden.
- Bei mehreren Optionen: Buchstabenliste **a / b / c / d** (klar, kurz)
- **Keine Fachbegriffe** ohne Erklärung. Lieber "Sicherungskopie" als "Git-Commit".
- **Bei Unsicherheit fragen**, nicht raten. Lieber 3× zu viel fragen als 1× falsch coden.

---

## 🏗️ 2. ARCHITEKTUR-PRINZIPIEN (NICHT VERHANDELBAR)

### Module-First-Prinzip
Jedes neue Feature lebt in **eigenem `module_X`-Ordner** (Backend) mit:
- eigener `routes.py`
- eigener Mongo-Collection
- API-Prefix `/api/module-X/...`
- Frontend: eigene Page in `pages/<modul>/Module<Name>Page.jsx`

### Datenmasken-Prinzip
- Daten werden **nur einmal** gespeichert (Single Source of Truth)
- `module_kunden` ist die einzige Wahrheit für Kunden — die alte `customers`-Collection ist **TOT**
- Wenn ein Modul Kundendaten anzeigen soll: per `customer_id` referenzieren und beim Lesen live aus `module_kunden` joinen
- Cache-Felder (z.B. `customer_name` in `portals`) erlaubt, müssen aber bei jedem Lese-Zugriff aktualisiert werden
- **Ausnahme:** Rechnungen/Angebote/Aufträge dürfen Snapshot-Daten halten (GoBD-konform)

### Heute (Phase A) bereits umgesetzt:
- ✅ `portals` nutzt Live-Lookup aus `module_kunden`

### Noch ausstehend:
- ⏳ **Phase B:** `module_projekte` (`kunde_name`, `adresse` als Cache → Live-Lookup einbauen)
- ⏳ **Phase C:** `einsaetze` prüfen
- Vor jedem Refactor: **Snapshot der Collection nach `/tmp` ziehen**, dann erst ändern.

---

## 🎨 3. UI/UX-VEREINBARUNGEN

- **Theme-Logik:**
  - Preview = **Blau** (Domain enthält `preview` oder `emergentagent`)
  - Live = **Rot** (echte Domain)
  - Auf keinen Fall vermischen!
- **Sidebar-Schrift:** klein (text-sm), Icons w-4 h-4
- **„Einstellungen"** = Accordion-Eintrag mit Unterpunkten:
  - Duplikate, Artikel & Leistungen, Textvorlagen, Handy-Zugang, Wissen & Tipps
- **Notizen-Widget:** Floating-Button rechts unten (`module_feedback`), auf jeder Seite verfügbar
- **2-Spalten-Layout** in Portalen: Links Schriftwechsel, Rechts sticky Bilder/Dokumente
- **Keine Captchas:** Spam wird server-seitig gefiltert (`module_mail_inbox`)

---

## 🛡️ 4. SICHERHEIT BEI ÄNDERUNGEN

- **Vor jeder DB-Operation** (DELETE, UPDATE many): Snapshot in `/tmp/<collection>_<timestamp>.json`
- **Vor jedem größeren Refactor:** Ralph soll **„Save to Github"** machen, dann arbeiten wir
- **Niemals** Live-Daten anfassen ohne explizite Freigabe
- **Login-Accounts** (`admin`, `admin-preview`) NIE löschen
- **Notizen** (`module_feedback`) NIE leeren — das ist Ralphs Bugtracker

### Test-Credentials siehe `/app/memory/test_credentials.md`

---

## 🐛 5. WIEDERKEHRENDE FALLEN

| Fehler | Wie vermeiden |
|---|---|
| `lucide-react` Icon vergessen zu importieren | Vor jedem Speichern Icon-Imports prüfen |
| `React.Fragment` statt `Fragment` (named import) | Niemals `React.X` schreiben, immer named imports |
| MongoDB `_id` im Response | Immer `{"_id": 0, ...}` projection |
| Email `as_string()` statt `as_bytes()` | Wir nutzen UTF-8 → `as_bytes()` ist Pflicht |
| Mail-Templates ohne Umlaute (`begruessen`) | Encoding ist gefixt — echte Umlaute sind erlaubt und gewollt |
| Falsche Tokens aus Frontend in Mails | Token IMMER aus DB holen, nie aus Body-Parameter |
| Passwörter mit `0/O/1/l/I/5/S` | Helper `gen_portal_password()` nutzen |

---

## 📝 6. WORKFLOW-KETTE

### Bei neuer User-Anfrage:
1. Verstehen → in eigenen Worten zurückgeben
2. **Plan mit Optionen vorschlagen** (a/b/c/d)
3. Auf Bestätigung warten
4. Implementieren
5. Klein testen (curl, Screenshot)
6. Bei größerem Umbau: testing_agent_v3_fork
7. Vor `finish`: PRD.md aktualisieren

### Bei Mail/Portal-Themen:
- Ralph testet auf **Preview** (blau) mit Test-Kunden
- **NIE** auf Live mit echten Kunden experimentieren
- Live-DB ≠ Preview-DB (getrennt)

---

## 🎯 7. AKTUELL OFFENE PUNKTE (Stand 02.05.2026)

### P1 (höchste Priorität)
- 🟠 Phase B: `module_projekte` Datenmasken
- 🟠 Phase C: `einsaetze` Datenmasken-Audit
- 🟠 Auto-Portal-Einladung nach Mail-Inbox-Accept

### P2
- 🟡 Google Drive Backup (OAuth)
- 🟡 IMAP `\Seen`-Flag nach Accept/Reject
- 🟡 Portal-Import-Filter Bug (nur „Inaktiv" sichtbar)
- 🟡 Admin-Übersicht Monteur-App
- 🟡 Regression-Test (`testing_agent_v3_fork`) über alle Module

### P3 (Backlog)
- 🟢 `module_buchhaltung`: N26-CSV-Import + Auto-Kategorisierung + Cashflow
- 🟢 DATEV-Export
- 🟢 Echte Google Calendar API Sync

---

## ✅ 8. BESTÄTIGUNGS-PFLICHT

**Dein erstes Statement an Ralph muss enthalten:**

```
Moin Ralph, ich habe das Briefing gelesen und bestätige:

✅ Module-First: Neue Features bekommen eigene module_X-Ordner
✅ Datenmasken: module_kunden = Single Source of Truth
✅ Sprache: Deutsch, einfach, keine Fachbegriffe
✅ Stil: Plan vorschlagen → "Ja" abwarten → coden
✅ Sicherheit: Snapshots vor DB-Änderungen, NIE Live ohne Freigabe
✅ Notizen-Widget = Ralph's Bugtracker, NIE leeren
✅ Preview-Tests, dann Live-Migration

Wo möchtest du weitermachen?
- Phase B (Projekte-Datenmasken)
- Auto-Portal-Einladung
- Oder die Notizen aus dem Widget abarbeiten ("/api/module-feedback/list?status=offen")
```

**Ohne diese Bestätigung bitte nicht mit Code-Änderungen starten.**

---

## 📚 9. WICHTIGE DATEIEN

| Datei | Zweck |
|---|---|
| `/app/memory/PRD.md` | Produkt-Anforderungen, ständig aktualisiert |
| `/app/memory/AGENT_BRIEFING.md` | **DIESES Dokument**, Pflichtlektüre |
| `/app/memory/test_credentials.md` | Login-Daten für Preview/Live |
| `/app/backend/routes/portal.py` | Kunden-Portal (heute viel angefasst) |
| `/app/backend/module_kunden/` | Single Source of Truth |
| `/app/backend/module_feedback/` | Notizen-Widget Backend |
| `/app/frontend/src/components/FeedbackWidget.jsx` | Floating Notiz-Button |
| `/app/frontend/src/lib/imageCompress.js` | Browser-Bildkompression |

---

## 🏆 10. MOTTO

> **„Lieber 1 sauberes Modul als 5 schnelle Hacks."**
>
> Ralph baut langfristig — Code soll in 6 Monaten noch verständlich sein.
> Keine Refactorings ohne Auftrag, keine "Verbesserungen" außerhalb des Tasks.

**Gute Zusammenarbeit! 🚀**
