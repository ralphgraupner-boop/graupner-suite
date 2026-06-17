# Graupner Suite — Roadmap / Spätere Aufgaben

## 🟡 Dashboard überarbeiten (vorgemerkt 17.06.2026)
**Status:** Dashboard vorübergehend **ausgeblendet** (nicht zerstört).
- `DashboardPage.jsx` + Route `/dashboard` bleiben vollständig erhalten.
- Nav-Eintrag in `components/layout/Navigation.jsx` auskommentiert (Z. ~14, leicht reaktivierbar).
- Startseite nach Login umgestellt auf **/module/termine** (`App.js` `defaultPage`).
- Mobile „Home"-Button zeigt jetzt auf Termine.

**Später zu erledigen (wenn aktuelle Fehler behoben sind):**
- Aktuelle Stände korrigieren (Zähler-Definitionen prüfen: „Offene Angebote" zählt nur `Entwurf`, „Offene Aufträge" nur `Offen`, „Unbezahlte Rechnungen" nur `Offen`).
- Kachel **Auftragsbestätigungen** (Aufträge gesamt/offen) ergänzen — Daten vorhanden unter `stats.orders`.
- Kachel **Rechnungen** (gesamt) ergänzen.
- Kachel **Mail-Anfragen** (ungelesen) ergänzen.

**Reaktivieren:** Nav-Zeile wieder aktivieren + `defaultPage` zurück auf `/dashboard`.
