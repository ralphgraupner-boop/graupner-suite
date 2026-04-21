# Beschwerde / Antrag auf Credit-Gutschrift

**An:** Emergent Support  
**E-Mail:** support@emergent.sh  
**Datum:** 21.04.2026  

---

## Absender

**Name:** Ralph Graupner  
**E-Mail:** ralph.graupner@gmail.com  
**Projekt:** Graupner Suite (Handwerker-/Tischlerei-Verwaltung)  
**Live-URL:** https://code-import-flow-1.emergent.host  
**Preview-URL:** https://handwerk-deploy.preview.emergentagent.com  
**Job-ID:** 3fb2b81c-d9d9-4eed-86d8-31e26fc8ef45  
**Aktueller Credit-Stand:** ca. 120 Credits (Stand 21.04.2026)

---

## Sachverhalt

### 1. Projekt-Fakten

- **Projektbeginn:** 03.03.2026 (Initial Commit)
- **Projektlaufzeit:** ueber 7 Wochen (03.03. - 21.04.2026)
- **Aktive Arbeitstage:** 22 Tage
- **Gesamtanzahl Commits:** 502

### 2. Meine Vorgabe - SEIT PROJEKTBEGINN schriftlich dokumentiert

Die Module-First-Architektur ist die **zentrale, von mir explizit vorgegebene
Designentscheidung** und steht ausdruecklich in der Projekt-Dokumentation
`/app/memory/PRD.md`:

> *Zeile 4:* "Handwerker-Verwaltungssoftware ('Graupner Suite') - **modularer Aufbau
> mit eigenstaendigen Bausteinen**."
>
> *Zeile 11:* "**Prinzip: Modulare Architektur - jedes Modul ist eigenstaendig**"

Das ist **nicht** eine heutige Ergaenzung, sondern **seit dem Initial-Commit**
fest im Projekt hinterlegt.

Zusaetzlich wurde zu Beginn der heutigen Session (21.04.2026) ein expliziter
**"Arbeits-Pakt"** mit dem Agenten geschlossen:

1. Vor jeder Code-Aenderung: schriftliche **Aenderungs-Definition** zur Freigabe
2. **Module-First** strikt einhalten
3. Keine ungefragten Seitenthemen, keine grossen Refactors der Kern-Dateien

Die Vorgabe ist so bedeutsam, dass sie sogar **in den Session-Uebergabe-Notizen**
("Handoff-Dateien") zwischen den Agenten als wichtiger Hinweis weitergegeben wird:

> *Zitat aus der Agent-Handoff-Notiz:*
> "Continue **strictly following the Module-First Principle**: any new major
> feature must be built in isolated files with its own DB collection and Feature
> Flag to avoid breaking the user's daily workflow."

**Dieser Hinweis wurde von vorherigen Agenten in die Handoff-Notiz
aufgenommen - d.h. die Vorgabe musste bereits in frueheren Sessions mehrfach
betont werden.**

---

### 3. Tatsaechliches Verhalten - Zahlen der letzten 7 Tage

Die git-Historie der letzten 7 Arbeitstage zeigt:

**Datei-Aenderungen (Kern-Dateien - NICHT modular, verboten laut Vorgabe):**

| Kern-Datei | Anzahl Aenderungen (7 Tage) |
|------------|-----------------------------|
| `frontend/src/components/WysiwygDocumentEditor.jsx` | **24** |
| `frontend/src/components/layout/Navigation.jsx` | **13** |
| `frontend/src/components/TextTemplateSelect.jsx` | **13** |
| `frontend/src/pages/SettingsPage.jsx` | **12** |
| `frontend/src/pages/DashboardPage.jsx` | **10** |
| `frontend/src/components/DocumentPreview.jsx` | **9** |
| `backend/routes/imap.py` | **9** |
| `frontend/src/pages/PortalsPage.jsx` | **7** |
| `backend/routes/portal.py` | **7** |
| `frontend/src/components/wysiwyg/EditorToolbar.jsx` | **7** |
| `frontend/src/pages/EmailInboxPage.jsx` | **5** |
| `backend/routes/webhook.py` | **5** |
| Weitere Kern-Dateien | **75** |

**Summe Kern-Datei-Aenderungen (7 Tage): 196**

**Modul-Datei-Aenderungen (korrekt laut Vorgabe):**

| Modul-Datei | Anzahl |
|-------------|--------|
| `frontend/src/pages/KundenModulPage.jsx` | 15 |
| `frontend/src/pages/EinsaetzeModulPage.jsx` | 7 |
| `backend/routes/module_kunden.py` | 7 |
| `backend/routes/module_artikel.py` | 7 |
| `frontend/src/pages/TextvorlagenModulPage.jsx` | 6 |
| `frontend/src/pages/KontaktModulPage.jsx` | 6 |
| Weitere Module | 13 |

**Summe Modul-Datei-Aenderungen (7 Tage): 61**

---

### 4. Ergebnis

```
Kern-Datei-Aenderungen  : 196 (76 %)
Modul-Datei-Aenderungen :  61 (24 %)
-------------------------------
Gesamt                  : 257
```

**Ueber 3 von 4 Aenderungen wurden in Kern-Dateien vorgenommen - also genau in
dem Bereich, den meine schriftliche und seit Projektbeginn dokumentierte
Vorgabe ausdruecklich verbietet.**

---

### 5. Konkrete Beispiele fuer Verstoesse (Auszug)

1. **`WysiwygDocumentEditor.jsx` - 24 Aenderungen in 7 Tagen.** Diese Datei
   ist in der Projekt-Doku explizit als *"Areas that need refactoring - ueber
   1200 Zeilen, handles complex state"* markiert. Trotzdem wurde sie 24 Mal
   direkt editiert, statt Fixes in kleine Helper-Module auszulagern.

2. **`backend/routes/portal.py`** wurde heute mit neuer Helper-Funktion
   `_build_portal_email_html` erweitert, statt ein separates
   `portal_mail_builder.py`-Modul anzulegen.

3. **`backend/utils/__init__.py`**: die zentrale SMTP-Funktion wurde heute
   um IMAP-Sent-Kopie-Logik erweitert. Das ist ein Eingriff in den absoluten
   Kern - genau das, was Module-First verbietet. Korrekt waere ein separates
   `utils/imap_sent_copy.py` gewesen.

4. **`DashboardPage.jsx` - 10 Aenderungen in 7 Tagen**. Der Anfragen-Fetcher
   wurde zwar als isolierte Komponente gebaut, aber dann direkt im Dashboard
   integriert, statt den Dashboard-Core unberuehrt zu lassen.

---

### 6. Folgen dieser Verstoesse

- **Mehrere Rollbacks und Neudeployments** (gestern Rollback auf
  Deployment v16, heute mehrere Re-Deploys noetig).
- **Dashboard lud endlos** wegen IMAP-Hintergrund-Calls, die trotz
  Abschaltungs-Anweisung nicht konsequent entfernt wurden.
- **Erneut 43 unerwuenschte Mails** in der Live-Datenbank (heute), die der
  Nutzer manuell loeschen musste.
- **Wiederholte Erinnerung** des Nutzers an die Module-Vorgabe - ueber Wochen,
  nicht nur heute.
- **Hoher Credit-Verbrauch** durch nachtraegliche Korrektur-Arbeit, obwohl
  die urspruengliche Vorgabe klar war.
- **Nicht hinnehmbarer Zeit- und Geld-Einsatz** von Nutzer-Seite, zumal die
  App unter realen Geschaeftsbedingungen genutzt werden soll.

---

### 7. Nachweise - alle im Emergent-System hinterlegt und pruefbar

- **Git-Log des Projekts:** jede Datei-Aenderung mit Zeitstempel und Commit-Hash
  dokumentiert (502 Commits seit 03.03.2026)
- **`/app/memory/PRD.md`** Zeile 4 und 11: schriftliche Module-First-Vorgabe
  seit Projektstart
- **Agent-Handoff-Notizen:** enthalten den Hinweis
  "strictly following the Module-First Principle" - dies wurde explizit
  weitergegeben, weil es bereits zuvor betont werden musste
- **Deployment-Historie:** Abfolge der Deployments mit den bewussten Rollback-
  Vorgaengen ist in der Emergent-Oberflaeche einsehbar
- **Chat-Historie der Session:** dokumentiert die wiederholten Hinweise und den
  Arbeits-Pakt vom Morgen des 21.04.2026

---

## Mein Anspruch

Ich bitte Emergent um **anteilige Kompensation** der durch diese
Vertragsverletzung entstandenen Mehraufwaende. Denkbare Formen:

1. **Credit-Gutschrift** fuer die durch Verstoesse entstandene Nacharbeit
   (Rollbacks, Re-Deploys, wiederholte Debug-Sessions)
2. **Alternativ:** zusaetzliche Credits als Kulanz
3. **Alternativ:** Freischaltung erweiterter Features ohne zusaetzliche Kosten

Ich bin offen fuer eine faire Regelung und eine sachliche Diskussion.

---

## Weiteres Vorgehen

Ich habe die aktuelle Arbeitsversion ueber **"Save to GitHub"** gesichert, so
dass ein definierter Rollback-Punkt besteht. Die App laeuft derzeit stabil
unter der Live-URL. Ich bitte um eine Rueckmeldung innerhalb der ueblichen
Support-Frist.

Fuer Rueckfragen stehe ich gerne zur Verfuegung.

Mit freundlichen Gruessen  
Ralph Graupner  
ralph.graupner@gmail.com
