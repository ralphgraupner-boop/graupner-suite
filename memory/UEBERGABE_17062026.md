# Graupner Suite — Übergabe / Tagesbericht 17.06.2026 (Hamburger Zeit)

> Sprache: **Deutsch**. Inhaber/Freigabe: **nur Ralph Graupner**.
> **Credit-Regel:** MAX 1 Credit pro Aufgabe (Standard), MAX 3 pro Auftrag. Bei Überschreitung **sofort stoppen + melden**.
> **Arbeitsweise:** Nach **einer Aktion** stoppen und fragen „Soll ich weitermachen?". Ralph entscheidet immer.
> **Pflicht-Kopf über jedem Auftrag:** „⚠️ CREDIT-LIMIT: MAX 1 CREDIT. BEI ÜBERSCHREITUNG SOFORT STOPPEN."

---

## 🌍 Umgebungen
- **Preview (Entwicklung):** https://tischlerei-suite.preview.emergentagent.com — hier wird gearbeitet/getestet.
- **Live (Produktion):** https://code-import-flow-1.emergent.host — **kein Agent-Zugriff**. Änderungen kommen nur per **„Save to Github" + Redeploy** durch Ralph dorthin.

## 🔑 Test-Logins (Preview)
- Admin: `thorsten.graupner` / `Thorsten2026!`
- Mitarbeiter: `Heike Bolanka` / `Heike2026!`

---

## ✅ Heute erledigt (alles auf Preview)

| # | Aufgabe | Datei(en) | Status |
|---|---------|-----------|--------|
| 1 | Dashboard Mobil-Fix (Mitarbeiter-403 unterdrückt, Finanz-Kacheln ausgeblendet) | `pages/DashboardPage.jsx` | ✅ getestet |
| 2 | Dokument-Exit-Dialog: 3 Speichern-Optionen (zum Kunden / zum Projekt / Beenden) | `components/WysiwygDocumentEditor.jsx` | ✅ |
| 3 | Werkbank-Button „Kundenübersicht" | `pages/projekte/ProjektWerkbank.jsx` | ✅ |
| 4 | Aufgaben: Projekt-Dropdown im Formular (additiv) | `pages/aufgaben/ModuleAufgabenPage.jsx` | ✅ |
| 5 | Aufgaben: Projekt optional (Pflichtregel Kunde→Projekt entfernt) | `module_aufgaben/routes.py` + Frontend | ✅ curl |
| 6 | Floating-Buttons gestapelt; **Glühbirne entfernt** (F1 übernimmt); 3 Buttons kleiner & überlappungsfrei | `App.js`, `HelpToggle.jsx`(nur ausgehängt), `FeedbackWidget.jsx`, `WolkePopover.jsx`, `EinsatzFloatingButton.jsx` | ✅ |
| 7 | Scroll-nach-oben beim Öffnen eines Datensatzes | `KundenModulPage.jsx`, `KontaktModulPage.jsx`, `EmailInboxPage.jsx`, `ProjektWerkbank.jsx`, `EinsaetzeModulPage.jsx` | ✅ |
| 8 | Angebots-Gültigkeit: Hardcode `30` → Einstellung `default_quote_validity_days` | `components/WysiwygDocumentEditor.jsx` (Z.623) | ✅ |
| 9 | Projektsuche: Dialog „Kunde hat noch kein Projekt – anlegen? Ja/Nein" | `pages/projekte/ProjekteListe.jsx` | ✅ |
| 10 | **Fehler 1: Profi-Mail** – `.eml` bekommt Profi-HTML (Corporate-Design, Signatur, DSGVO) + PDF | `routes/eml_export.py` (nutzt `utils/email_signatur.wrap_email_body`) | ✅ getestet |
| 11 | Angebote/Aufträge-Listen: weitergewandelte ausblenden (Angebot „Beauftragt" / Auftrag „Abgerechnet") | `pages/QuotesPage.jsx`, `pages/OrdersPage.jsx` | ✅ daten-verifiziert |
| 12 | Dashboard **ausgeblendet** (nicht zerstört); Startseite = **Termine**; Aufgabe + Roadmap angelegt | `App.js`, `components/layout/Navigation.jsx`, `memory/ROADMAP.md` | ✅ getestet |

## 🔍 Analysen (kein Code) — wichtige Befunde
- **Wartungs-Tab fehlt auf Live:** KEIN Code-Fehler – Tab ist bedingungslos im Code. Ursache = Deploy/GitHub-Pipeline. Lösung: „Save to Github" + Redeploy, sonst Emergent-Support.
- **Direkter Mailversand existiert schon im Backend:** `utils/send_email()` (SMTP-SSL) + `POST /email/document/{typ}/{id}` (Profi-HTML + PDF + Protokoll). Nur **nicht im UI verdrahtet**, SMTP-Daten (Jimdo) noch nicht hinterlegt. → „Option B".
- Sonderzeichen-/Umlaut-Suche: keine integrierte Suche; Umlaut-**Reparatur** existiert (Einstellungen → Wartung).

---

## 📌 Offen / für morgen
- **P0 – Dashboard überarbeiten** (ausgeblendet, Aufgabe `95b4b4e8…` angelegt): aktuelle Stände korrigieren, Kacheln **Auftragsbestätigungen**, **Rechnungen (gesamt)**, **Mail-Anfragen (ungelesen)** ergänzen. Zähler-Definitionen prüfen (z. B. „Offene Angebote" zählt nur `Entwurf`).
- **P1 – Option B: Direkter Mailversand aus der Suite (Jimdo-SMTP)** – `/email/document` per „Direkt senden"-Button verdrahten. **Braucht von Ralph: Jimdo-SMTP-Daten** (Server, Port, Benutzer/volle Mail, Passwort). Integration → über Integrations-Experten.
- **P1 – Wartungs-Tab auf Live sichtbar machen** (GitHub-Save + Redeploy / Support).
- **P2 – Profi-Mail auch für „Betterbird direkt"** (hängt vom lokalen Helfer ab) bzw. via Option B abgedeckt.

## ⚠️ Gesperrte Dateien (NICHT anfassen)
`pdf_generator.py`, `routes_v1.py`, `dokumente_v2`, `dokumente_v6`, **Live-Datenbank**.

## ➡️ Nächster Schritt für Ralph
1. Auf Preview testen.
2. Wenn gut: **„Save to Github" + Redeploy** → Änderungen gehen auf Live.
