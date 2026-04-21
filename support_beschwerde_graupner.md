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

### 1. Meine Vorgabe (seit Projektbeginn und mehrfach wiederholt)

Ich habe wiederholt und nachweislich festgelegt, dass neue Features und Bug-Fixes in meiner
Graupner Suite **ausschließlich modular** (Module-First-Prinzip) umzusetzen sind:

- Eigene Backend-Route je Modul (z.B. `routes/module_kunden.py`)
- Eigene Frontend-Seite je Modul (z.B. `pages/KundenModulPage.jsx`)
- Eigene DB-Collection
- Feature-Flag in den Einstellungen zum An-/Ausschalten

Diese Vorgabe ist fest im Projekt dokumentiert in `/app/memory/PRD.md` unter der Rubrik
*"Code Architecture / Module-First Principle"*:

> *"Module-First Principle: New features (like Rechnungen v2) are built completely isolated
> (`routes/rechnungen_v2.py`, `RechnungenV2Page.jsx`, own DB collection, and a Feature Flag
> in Settings) to prevent regressions in the core app."*

Zu Beginn der heutigen Session (21.04.2026) wurde zusätzlich ein expliziter
**"Arbeits-Pakt"** geschlossen:

1. Vor jeder Code-Änderung: schriftliche **Änderungs-Definition** zur Freigabe
2. **Modul-First** strikt einhalten
3. Keine ungefragten Seitenthemen, keine großen Refactors der Kern-Dateien

---

### 2. Tatsächliches Verhalten des Agenten

Die git-Historie der letzten 2 Tage zeigt folgende Datei-Änderungen:

**Kern-Dateien (NICHT modular – verboten laut Vorgabe):**

| Datei | Anzahl Änderungen |
|-------|-------------------|
| `frontend/src/pages/PortalsPage.jsx` | 3 |
| `frontend/src/pages/DashboardPage.jsx` | 3 |
| `backend/routes/portal.py` | 3 |
| `frontend/src/pages/SettingsPage.jsx` | 2 |
| `frontend/src/pages/EmailInboxPage.jsx` | 1 |
| `frontend/src/pages/CustomerPortalPage.jsx` | 1 |
| `frontend/src/components/WysiwygDocumentEditor.jsx` | 1 |
| `frontend/src/components/DocumentPreview.jsx` | 1 |
| `backend/routes/imap.py` | 1 |
| `backend/routes/email.py` | 1 |
| **Summe Kern-Dateien** | **17 Änderungen** |

**Modul-Dateien (korrekt laut Vorgabe):**

| Datei | Anzahl Änderungen |
|-------|-------------------|
| `frontend/src/pages/KundenModulPage.jsx` | 2 |
| `frontend/src/pages/TextvorlagenModulPage.jsx` | 1 |
| `frontend/src/pages/KontaktModulPage.jsx` | 1 |
| `backend/routes/module_textvorlagen.py` | 1 |
| `backend/routes/module_kunden.py` | 1 |
| **Summe Modul-Dateien** | **6 Änderungen** |

**Ergebnis: ca. 75 % aller Änderungen wurden in Kern-Dateien gemacht, obwohl meine
schriftliche Vorgabe das Gegenteil fordert.**

---

### 3. Konkrete Beispiele für Verstöße (Auszug)

1. **`WysiwygDocumentEditor.jsx`**: direkt editiert, obwohl in der Projekt-Dokumentation
   explizit als *"nicht anfassen – 1200 Zeilen, kritisch"* markiert.
   Korrekt wäre ein separates Fix-/Helper-Modul gewesen.

2. **`backend/routes/portal.py`**: mit neuer Helper-Funktion `_build_portal_email_html`
   erweitert, obwohl ein separates `portal_mail_builder.py`-Modul korrekt gewesen wäre.

3. **`backend/utils/__init__.py`**: die zentrale SMTP-Funktion wurde um IMAP-Sent-Kopie-Logik
   erweitert. Das ist ein Eingriff in den Kern – genau das, was Module-First verbietet.
   Korrekt wäre ein separates `utils/imap_sent_copy.py` gewesen.

4. **`DashboardPage.jsx`**: direkt erweitert mit Anfragen-Fetcher-Integration, obwohl die
   Integration als isolierte Komponente hätte bleiben müssen.

---

### 4. Folgen dieser Verstöße

- **Mehrfache Fehlersuche und Rollbacks** (gestern mehrere Deployments, Rollback auf
  Deployment v16 nötig, Dashboard lud endlos wegen IMAP-Hintergrund-Calls).
- **Heute erneut** unerwünschte Mail-Abholungen in die Live-Datenbank (43 Mails), die vom
  Nutzer manuell gelöscht werden mussten.
- **Hoher Credit-Verbrauch** durch nachträgliche Korrektur-Arbeit, obwohl die ursprüngliche
  Vorgabe klar war.
- **Verlust an Vertrauen und Arbeitszeit** auf Nutzer-Seite, insbesondere da die App
  unter laufenden Geschäftsbedingungen genutzt werden soll.

---

### 5. Nachweise

Alle genannten Fakten sind beweisbar:

- **Git-Log:** Jede Änderung ist mit Zeitstempel und Commit-Hash dokumentiert
  (im Projekt-Repository nachvollziehbar)
- **`/app/memory/PRD.md`**: enthält die schriftliche Vorgabe zum Module-First-Prinzip
- **Chat-Historie:** Dokumentiert die wiederholten Hinweise an den Agenten und die
  ausdrückliche Vereinbarung vom Morgen des 21.04.2026
- **Deployment-Historie:** Die Abfolge der Deployments v15 → v17 → Rollback v16 → v20 → v25
  ist in der Emergent-Oberfläche einsehbar

---

## Mein Anspruch

Ich bitte Emergent um **anteilige Kompensation** der durch diese Vertragsverletzung
entstandenen Mehraufwände. Denkbare Formen:

1. **Credit-Gutschrift** für die durch Verstöße entstandene Nacharbeit
2. **Alternativ:** zusätzliche Credits als Kulanz
3. **Alternativ:** Freischaltung erweiterter Features ohne zusätzliche Kosten

Ich bin offen für eine faire Regelung und eine sachliche Diskussion.

---

## Weiteres Vorgehen

Ich habe die aktuelle Arbeitsversion über **"Save to GitHub"** gesichert, so dass ein
definierter Rollback-Punkt besteht. Die App läuft derzeit stabil unter der Live-URL. Ich
bitte um eine Rückmeldung innerhalb der üblichen Support-Frist.

Für Rückfragen stehe ich gerne zur Verfügung.

Mit freundlichen Grüßen  
Ralph Graupner  
ralph.graupner@gmail.com
