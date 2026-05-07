# 🚦 START-CHECKLISTE FÜR NEUE AGENTEN

> **Stand: 07.05.2026**
> Diese Datei MUSS jeder Agent vor seiner ersten Antwort lesen — Ralph hat
> dafür mehrfach Zeit und Geld verloren, weil Architektur-Regeln ignoriert
> wurden. Wer hier abkürzt, liefert Schrott.

---

## ✋ Vor dem Antworten

In **dieser Reihenfolge** lesen — keine Ausnahmen:

1. **`/app/memory/VISION.md`** — Architektur-Regeln (Module-First, Datenmasken, Auswahlfelder, Soft-Delete)
2. **`/app/memory/MODUL_LANDKARTE_GESAMT.svg`** — Übersicht aller Module
3. **`/app/memory/DOKUMENTE_MODULE_GRAPH.md`** — Detail Dokumente-Workflow (oder die Detail-Graphik des Moduls, an dem gearbeitet wird)
4. **`/app/memory/PRD.md`** — Was bereits gebaut wurde, mit Datum
5. **`/app/memory/AGENT_BRIEFING.md`** — Kommunikations- und Verhaltensregeln

---

## 🚨 Top-5-Fehler die seit Wochen passieren — NICHT MEHR MACHEN

### 1. Hartcodierte Auswahllisten
❌ `VALID_KATEGORIEN = ["auto", "werkzeug", …]` im Backend
❌ `KATEGORIE_LABELS = {auto: "Auto"}` im Frontend
✅ Live aus `module_textvorlagen` mit eigenem `doc_type`

### 2. Neue Module für Auswahlfelder erfinden
❌ `module_kunden_status/`, `module_kategorien/`, `module_status/`
✅ Alles in `module_textvorlagen` mit `doc_type=kunden_status` etc.

### 3. Daten duplizieren statt joinen (Datenmasken-Verstoß)
❌ `kunde_name` oder `adresse` in `module_projekte` speichern
✅ Live aus `module_kunden` per `kunde_id` joinen — bei jedem Read

### 4. Code in `routes/*.py` neu anlegen
❌ Neue Datei `routes/mein_neues_feature.py`
✅ Neuer Ordner `module_<name>/` mit eigenem `routes.py` und `__init__.py`

### 5. Vor Architektur-Entscheidungen nicht fragen
❌ "Ich baue Dir einfach mal …"
✅ "Soll das in ein eigenes Modul oder in `module_X`? a) … b) …"

---

## 🗺️ Welche Module existieren (Stand 07.05.2026)

Komplett-Übersicht: siehe `MODUL_LANDKARTE_GESAMT.svg`

| Bereich | Modul-Verzeichnis | Hauptpfad |
|---|---|---|
| Kunden | `module_kunden/` | `/api/customers`, `/api/modules/kunden` |
| Aufträge | `module_auftraege/` | `/api/orders` |
| Angebote | `module_angebote/` | `/api/quotes` |
| Rechnungen | `module_rechnungen/` | `/api/invoices` |
| Dokumente (Tab-Wrapper + Vorlagen) | `module_dokumente/` | `/api/document-templates`, `/api/documents` |
| Einsätze | `module_einsaetze/` | `/api/einsaetze`, `/api/einsatz-config` |
| Aufgaben | `module_aufgaben/` | `/api/module-aufgaben` |
| Projekte | `module_projekte/` | `/api/module-projekte` |
| Termine | `module_termine/` | `/api/module-termine` |
| Mail-Inbox | `module_mail_inbox/` | `/api/module-mail-inbox` |
| Kundenportal | `module_kundenportal/` | `/api/portals`, `/api/portals-klon` |
| Buchhaltung | `module_buchhaltung/` | `/api/buchhaltung` |
| Artikel | `module_artikel/` | `/api/modules/artikel` |
| Textvorlagen (Source-of-Truth Auswahl!) | `module_textvorlagen/` | `/api/modules/textvorlagen` |
| Kundenlink | `module_kundenlink/` | `/api/module-kundenlink` |
| Feedback / Bug-Tracker | `module_feedback/` | `/api/module-feedback` |
| Papierkorb (Soft-Delete) | `module_papierkorb/` | `/api/papierkorb` |
| Duplikate | `module_duplikate/` | `/api/duplikate` |
| Health-Check | `module_health/` | `/api/health` |
| Export/Backup | `module_export/` + `module_kalender_export/` | `/api/export`, `/api/kalender-export` |
| User-Settings | `module_user_prefs/` | `/api/user-prefs` |
| Kunde-Löschen (DSGVO) | `module_kunde_delete/` | `/api/kunde-delete` |

**Querschnitt (kein eigenes Datenobjekt → kein eigenes Modul nötig):**
`routes/auth.py`, `routes/email.py`, `routes/imap.py`, `routes/pdf.py`,
`routes/push.py`, `routes/dashboard.py`, `routes/settings.py`,
`routes/mitarbeiter.py`, `routes/articles.py`, `routes/leistungsbloecke.py`,
`routes/text_templates.py`, `routes/services.py`, `routes/webhook.py`,
`routes/auto_backup.py`, `routes/backup.py`, `routes/diverses.py`,
`routes/distance.py`, `routes/anfragen*.py`, `routes/kalkulation.py`,
`routes/ai.py`, `routes/modules.py`.

---

## 🧭 Was Du JEDE Sitzung mit Ralph machst

1. **Begrüßen, Sprache prüfen:** Deutsch, einfach, konsultativ.
2. **Lesen** der oben genannten 5 Dateien.
3. **Plan vorschlagen** mit a/b/c-Optionen, **auf "Ja" warten**.
4. **Vor Code-Änderung** prüfen: betrifft das ein bestehendes Modul? → dort hin.
   Neues Datenobjekt? → eigenes `module_*/` mit `routes.py` + `__init__.py`.
5. **Nach Änderung:** kurz curl-Test + Smoke-Screenshot. Erst dann „fertig" sagen.
6. **Beim Abschluss:** PRD.md fortschreiben (was wurde wann gemacht).

---

## ❌ Was Du NIE tust

- Standard-/Werbetexte über Emergent, Upgrades, "kostenpflichtigen Plan"
  posten. Ralph hat das mehrfach untersagt.
- Vor Architektur-Entscheidungen still loslegen.
- Hartcodierte Listen anlegen, auch nicht "als Fallback".
- Neue Module für Auswahlfelder anlegen (siehe `module_textvorlagen`).
- Code-Pfade in `routes/` neu erweitern, ohne vorher zu prüfen ob ein
  Modul-Verzeichnis besser passt.

---

## 📌 Tagesablauf für Ralph (was er an den Anfang JEDER neuen Sitzung pastet)

```
Vor Beginn: Lies in dieser Reihenfolge:
1) /app/memory/AGENT_START_CHECKLISTE.md
2) /app/memory/VISION.md
3) /app/memory/MODUL_LANDKARTE_GESAMT.svg (Übersicht ALLE Module)
4) /app/memory/PRD.md
Bestätige mir kurz, dass Du alle vier gelesen hast und nenne mir die 5
"NICHT MEHR MACHEN"-Punkte aus der Checkliste. Erst dann starten wir.
```

Wenn der Agent das **nicht** beantworten kann → er hat nicht gelesen → Frage
abbrechen und neu starten. Das ist Ralphs Schutz.
