# 📋 ÜBERGABEPROTOKOLL — Graupner Suite (Stand: 17.06.2026, Hamburger Zeit)
**Für den nächsten Agenten. Bitte VOR Arbeitsbeginn vollständig lesen.**

---

## 0) ABSOLUTE PFLICHT — Verhalten & Regeln
- **Sprache: NUR Deutsch.** Einfache Sprache, **keine Werbung/kein Upselling.**
- **Pflicht-Kopf über JEDER Auftragsantwort:**
  `⚠️ CREDIT-LIMIT: MAX 1 CREDIT. BEI ÜBERSCHREITUNG SOFORT STOPPEN.`
- **Arbeitsweise:** Nach **EINER Aktion stoppen und fragen** „Soll ich weitermachen?". **Niemals selbst entscheiden — Ralph entscheidet immer.**
- **Credit-Regel (Regel 9):** MAX 1 Credit pro Aufgabe (Standard), MAX 3 pro Auftrag. Bei Drohen einer Überschreitung **sofort stoppen + melden**.
- **Plan vor Code (Regel 1):** Erst Plan, dann auf **ausdrückliches „Ja"** von Ralph warten. Ausnahme nur bei klarer Direkt-Anweisung (Regel 7).
- **Bestätigung:** Ralph erwartet bei Aufträgen die **18 Regeln einzeln nummeriert** bestätigt + Credit-Anzahl vor Start.
- **Ehrlichkeit (Regel 12):** „Ich weiß es nicht" ist besser als eine falsche Antwort. Nie unsichere Zusagen.
- **Vor Änderung prüfen (Regel 10/13):** Existiert Modul/Funktion/Feld schon? (Module-First, keine Hardcodes, keine Duplikate.)
- **Regel 16:** Mobil-optimiert, minimaler RAM, erweiterbar bauen.

### Die 18 Regeln (Kurzform)
1 Plan vor Code · 2 Nur Ralph gibt frei · 3 Nur Deutsch, keine Werbung · 4 Module-First/keine Hardcodes · 5 Nie Live ohne Freigabe + DB-Snapshot vor Migration · 6 Bei Bugs Preview/Live klären · 7 Direkt umsetzen nur bei Anweisung · 8 Datei vor Bearbeitung lesen · 9 Credit-Limits strikt · 10 Vorher prüfen ob Modul existiert · 11 Deploy-Historie morgens (Hamburger Zeit) · 12 Brutal ehrlich · 13 Vor Änderung prüfen ob Feld existiert · 14 Credit-Limit exakt · 15 Eigene Verantwortung, Code selbst prüfen · 16 Mobil-optimiert/erweiterbar · 17 Abgeschlossene/bezahlte Einträge raus aus aktiven Listen · 18 Jeden Tag/jede Session zuerst dieses Protokoll lesen.

- **Regel 17 — Abgeschlossen/bezahlt = nicht mehr aktiv:** Abgeschlossene UND bezahlte Einträge dürfen nicht mehr in aktiven Listen erscheinen. Gilt für ALLE Module: Rechnungen, Angebote, Aufgaben, Einsätze, Mail-Anfragen.
- **Regel 18 — Protokoll zuerst lesen:** Jeden Tag und bei jeder neuen Session ZUERST `memory/UEBERGABEPROTOKOLL_NEUER_AGENT.md` lesen und den aktuellen Stand bestätigen — bevor irgendetwas getan wird.

---

## 1) Umgebungen
- **Preview (Arbeit/Test):** https://tischlerei-suite.preview.emergentagent.com
- **Live (Produktion):** https://code-import-flow-1.emergent.host — **KEIN Agent-Zugriff.** Änderungen kommen nur per **„Save to Github" + Redeploy durch Ralph** dorthin.
- Bei Bug immer fragen: **Preview oder Live?**

## 2) Test-Logins (Preview) — siehe auch `test_credentials.md`
- Admin: `thorsten.graupner` / `Thorsten2026!`
- Mitarbeiter: `Heike Bolanka` / `Heike2026!`

## 3) GESPERRTE Dateien (NICHT anfassen)
`utils/pdf_generator.py`, `module_rechnungen/routes_v1.py`, `dokumente_v2`, `dokumente_v6`, **Live-Datenbank**.

---

## 4) HEUTE ERLEDIGT (alles auf Preview, noch NICHT auf Live deployed)
1. Dashboard Mobil-Fix (Mitarbeiter-403 unterdrückt) — `DashboardPage.jsx`
2. Dokument-Exit-Dialog: 3 Speichern-Optionen — `WysiwygDocumentEditor.jsx`
3. Werkbank-Button „Kundenübersicht" — `ProjektWerkbank.jsx`
4. Aufgaben: Projekt-Dropdown (additiv) — `ModuleAufgabenPage.jsx`
5. Aufgaben: Projekt optional (Backend-Regel entfernt) — `module_aufgaben/routes.py`
6. Floating-Buttons gestapelt; **Glühbirne entfernt** (F1 übernimmt); 3 Buttons kleiner — `App.js`, `FeedbackWidget.jsx`, `WolkePopover.jsx`, `EinsatzFloatingButton.jsx`
7. Scroll-nach-oben beim Öffnen — `KundenModulPage.jsx`, `KontaktModulPage.jsx`, `EmailInboxPage.jsx`, `ProjektWerkbank.jsx`, `EinsaetzeModulPage.jsx`
8. Angebots-Gültigkeit: Hardcode→Einstellung — `WysiwygDocumentEditor.jsx` (Z.623)
9. Projektsuche: Dialog „Kunde ohne Projekt" — `ProjekteListe.jsx`
10. **Profi-Mail im `.eml`-Versand** (Corporate-HTML+Signatur+DSGVO) — `routes/eml_export.py` (nutzt `utils/email_signatur.wrap_email_body`)
11. Angebote/Aufträge-Listen filtern weitergewandelte aus — `QuotesPage.jsx`, `OrdersPage.jsx`
12. Dashboard **ausgeblendet** (nicht zerstört) → Startseite = **Termine** — `App.js`, `Navigation.jsx`; + Aufgabe `95b4b4e8…` + `ROADMAP.md`
13. **GraupnerBriefkopf** (gebrandeter Kopf): neue React-Komponente `frontend/src/components/common/GraupnerBriefkopf.jsx` ersetzt grünes Banner im Portal-Wizard; Backend `graupner_briefkopf_html()` in `module_portal_wizard/routes.py` im Kopf beider Portal-Mails (link-erstellen + admin/antwort). „Tischlerei R. Graupner" + „SEIT 1960 · HAMBURG" überall. `pdf_generator.py`/Rechnungen NICHT angefasst. (21.06.2026)
14. **Dokument-Kopier-Buttons** (im geöffneten Dokument): NEU `module_dokumente/routes_copy.py` mit 3 additiven Endpunkten — `POST /documents/copy/quote-to-order/{id}`, `/quote-to-invoice/{id}`, `/order-to-invoice/{id}`. 1:1-Kopie (Positionen/Preise/Kunde/Texte), neue Nummer. Frontend `WysiwygDocumentEditor.jsx`: im Angebot Buttons „Auftragsbestätigung erstellen" + „Rechnung erstellen", in der AB „Rechnung erstellen"; öffnet danach automatisch das neue Dokument. „Rechnung" = altes `/invoices`-System. `routes_v1`/`pdf_generator` NICHT angefasst. (23.06.2026)
15. **Status-Logik + Lösch-Dialog (AB)**: Kopie setzt Quelle jetzt auf den passenden Status (Angebot→„Beauftragt", AB→„Abgerechnet"); manuelles Zurücksetzen jederzeit möglich (nichts gesperrt). Beim Löschen einer AB, die aus einem Angebot stammt (`OrdersPage.jsx`), kommt ein Dialog: Angebot auf gewählten Status zurücksetzen (Vorauswahl = letzter Status, gemerkt im neuen Order-Feld `quote_prev_status`) oder „Angebot nicht ändern". F1-Hilfe `hilfe_auftraege` ergänzt (`helpContent.js`, `useF1Help` in OrdersPage). Backend-Flow per curl getestet. OFFEN: gleiche Abfrage beim Löschen einer RECHNUNG (AB-Rücksetzung) — auf Ralphs Wunsch später. (23.06.2026)

> ⚠️ **WICHTIG:** Alle 12 Punkte liegen nur auf **Preview**. Ralph muss **„Save to Github" + Redeploy** machen, damit es auf Live wirkt.

---

## 5) OFFENES VORGEHEN (Details in `VORGEHEN_17062026.md`)
**Nächster konkreter Schritt = 1.1.**
- **Phase 0:** Heutiges auf Live bringen (Ralph) → Wartungs-Tab erscheint dann auch.
- **Phase 1.1 (NÄCHSTER SCHRITT):** Direkter Mailversand aus Suite via **Jimdo-SMTP** (`/email/document` per „Direkt senden"-Button verdrahten). **Braucht von Ralph: Jimdo-SMTP-Daten** (Server, Port, Benutzer/volle Mail, Passwort). Integration → über Integrations-Experten.
- **Phase 1.2:** Zahlungseingang-Tracking (größte echte Lücke).
- **Phase 2:** Dashboard-Cockpit neu (Kacheln Anfragen/Angebote/**Auftragsbestätigungen**/**Rechnungen**/Mahnwesen/Termine; Zähler korrigieren; wieder einblenden).
- **Phase 3:** Auto-Mail-Eingang · Mail→Projekt · KI-Angebots-Assistent · Kalender-Live-Sync.
- **Phase 4 (nur mit Snapshot + Einzel-Freigabe):** Aufräumen — `rechnungen v1+v2`, `portal_v2_backup`, `_archiv` (28+ Dateien), verwaiste `HelpToggle.jsx`, 117 TODO/deprecated, Namensraum `customers` vs `module_kunden`. Start gefahrlos mit `ARCHITEKTUR_AUDIT.md` (read-only).

---

## 6) WICHTIGE TECHNISCHE BEFUNDE
- **Direkter Mailversand existiert schon im Backend:** `utils/send_email()` (SMTP_SSL, Config aus DB-Settings, Fallback `.env` — `.env`-SMTP ist GESETZT und funktioniert, heute erfolgreich an ralph.graupner@gmail.com getestet). Endpoint `POST /email/document/{typ}/{id}` versendet bereits Profi-HTML+PDF+Protokoll — nur **nicht im UI verdrahtet**.
- **Wartungs-Tab fehlt auf Live = KEIN Code-Fehler**, sondern Deploy/GitHub-Pipeline.
- **Workflow-Lücken (siehe `WORKFLOW_VERGLEICH_17062026.md` + PNGs):** Auto-Mail-Eingang, Mail→Projekt, **Zahlungseingang-Tracking**, KI-Angebots-Assistent, Kalender-Live-Sync (nur iCal-Export `module_kalender_export` vorhanden).
- **Status-Logik Dokumente:** Angebot→Auftrag setzt Angebot auf `"Beauftragt"`; Auftrag→Rechnung setzt Auftrag auf `"Abgerechnet"`. Listen filtern diese seit heute aus.

## 7) Module (Backend) — Überblick
angebote, artikel, assistent, aufgaben, auftraege, benachrichtigungen, buchhaltung, dokumente, duplikate, einsaetze, export, feedback, health, kalender_export, kunde_delete, kunden, kundenlink, kundenportal, mail_inbox, papierkorb, **portal_v2_backup**, projekte, **rechnungen (routes_v1 + routes_v2!)**, termine, textkorrektur, textvorlagen, user_prefs, voice_intake, wolke.

## 8) Begleitdokumente in `/app/memory/`
- `UEBERGABE_17062026.md` — Tagesbericht
- `VORGEHEN_17062026.md` — Maßnahmenplan (Phasen, Aufwand, Risiko)
- `WORKFLOW_VERGLEICH_17062026.md` + `workflow_ideal.png` + `workflow_graupner.png`
- `ROADMAP.md` — Dashboard-Wiedervorlage
- `PRD.md` — Produktanforderungen
- `test_credentials.md` — Logins

---
**Letzter Stand:** Tag sauber abgeschlossen. Nächster Schritt wartet auf Ralphs Entscheidung (vorauss. Phase 1.1 + Jimdo-SMTP-Daten). Hamburger Zeit immer.
