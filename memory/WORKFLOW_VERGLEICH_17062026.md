# Arbeitsablauf-Vergleich: Idealer Dienstleistungsprozess ↔ Graupner Suite
**Stand: 17.06.2026 (Hamburger Zeit) — read-only, kein Code geändert**

> Hinweis: Die Diagramme sind in **Mermaid** geschrieben. Sie werden in GitHub, VS Code (mit Mermaid-Plugin) und vielen Markdown-Viewern **bildlich** als Flussdiagramm angezeigt.

---

## 1) Idealer Arbeitsablauf eines Dienstleistungsunternehmens (Anfrage → Rechnung)

```mermaid
flowchart TD
    A["1. Anfrage<br/>(Mail / Telefon / Web)"] --> B["2. Erfassung & Kontakt<br/>Kunde anlegen/zuordnen"]
    B --> C["3. Bedarfsklärung<br/>Besichtigung / Aufmaß"]
    C --> D["4. Angebot erstellen"]
    D --> E{"5. Kunde<br/>entscheidet?"}
    E -->|Nein| E1["Nachfassen / Angebot anpassen"] --> D
    E -->|Ja| F["6. Auftragsbestätigung"]
    F --> G["7. Terminierung & Ressourcen<br/>Monteur / Material"]
    G --> H["8. Leistungserbringung<br/>Einsatz vor Ort + Doku/Fotos"]
    H --> I["9. Abnahme / Fertigmeldung"]
    I --> J["10. Rechnungstellung"]
    J --> K{"11. Zahlungs-<br/>eingang?"}
    K -->|Ja| L["12. Abschluss & Nachbetreuung"]
    K -->|Nein| M["Mahnwesen"] --> K
```

---

## 2) Graupner Suite — Ist-Zustand (mit zugeordneten Modulen)

```mermaid
flowchart TD
    A["1. Anfrage<br/>module_mail_inbox / anfragen"]:::ok --> B["2. Kunde erfassen<br/>module_kunden (+ Anfrage→Kunde)"]:::ok
    B --> C["3. Bedarf / Besichtigung<br/>Termine (Typ Besichtigung)"]:::warn
    C --> D["4. Angebot<br/>module_angebote (quotes)"]:::ok
    D --> F["6. Auftragsbestätigung<br/>module_auftraege (from-quote)"]:::ok
    F --> G["7. Terminierung<br/>module_termine (GO-Workflow)"]:::ok
    G --> H["8. Einsatz vor Ort<br/>module_einsaetze + Monteur-App"]:::ok
    H --> I["9. Fertigmeldung<br/>Einsatz-Status / Aufgaben"]:::warn
    I --> J["10. Rechnung<br/>module_rechnungen (from-order)"]:::ok
    J --> K["11. Zahlungseingang<br/>FEHLT (kein Abgleich)"]:::miss
    K --> M["Mahnwesen<br/>Dashboard overdue"]:::warn
    J --> N["Versand<br/>.eml/Betterbird • Jimdo geplant"]:::warn

    P["Projekte / Werkbank<br/>module_projekte"]:::ok -.klammert.- D
    Q["Kommunikation<br/>Wolke • Kundenportale"]:::ok -.begleitet.- H
    R["Aufgaben<br/>module_aufgaben"]:::ok -.begleitet.- G

    classDef ok fill:#dcfce7,stroke:#16a34a,color:#14532d;
    classDef warn fill:#fef9c3,stroke:#ca8a04,color:#713f12;
    classDef miss fill:#fee2e2,stroke:#dc2626,color:#7f1d1d;
```
*Legende:* 🟩 vorhanden · 🟨 teilweise/manuell · 🟥 fehlt

---

## 3) Vergleichstabelle Schritt für Schritt

| # | Idealer Schritt | Graupner-Modul | Status | Lücke / Anmerkung |
|---|-----------------|----------------|:------:|-------------------|
| 1 | Anfrage | `mail_inbox`, `anfragen` | 🟨 | Mail landet **nicht automatisch** in der Suite (Ingest fehlt) |
| 2 | Kunde erfassen | `kunden` (+ Anfrage→Kunde) | 🟩 | Umwandlung vorhanden (`dashboard.py`) |
| 3 | Bedarf/Besichtigung | `termine` (Typ Besichtigung) | 🟨 | Kein strukturierter „Aufmaß/Bedarf"-Schritt |
| 4 | Angebot | `angebote` (quotes) | 🟩 | Gültigkeit jetzt aus Einstellungen (heute gefixt) |
| 5 | Entscheidung/Nachfassen | Status `Versendet`/`Beauftragt` | 🟨 | Kein aktives Nachfass-/Erinnerungs-System |
| 6 | Auftragsbestätigung | `auftraege` (from-quote) | 🟩 | Angebot→Auftrag setzt Status „Beauftragt" |
| 7 | Terminierung/Ressourcen | `termine` (GO), `aufgaben` | 🟩 | GO-Workflow vorhanden |
| 8 | Leistung vor Ort | `einsaetze`, Monteur-App | 🟩 | Doku/Fotos/Reparaturauftrag |
| 9 | Abnahme/Fertigmeldung | Einsatz-Status / Aufgaben | 🟨 | Kein klarer „Abnahme"-Schritt mit Kundenunterschrift |
| 10 | Rechnung | `rechnungen` (from-order) | 🟩 | Auftrag→Rechnung setzt „Abgerechnet"; **2 Systeme** (v1/v2) |
| 11 | Zahlungseingang | — | 🟥 | **Kein Zahlungsabgleich/-Tracking** |
| 12 | Mahnwesen/Abschluss | Dashboard overdue | 🟨 | Mahnungen nur Anzeige, kein Mahnlauf-Workflow |
| – | Versand | `.eml`/Betterbird, `eml_export` | 🟨 | Profi-HTML heute ergänzt; direkter Jimdo-SMTP-Versand vorbereitet (Option B) |
| – | Kommunikation | `wolke`, `kundenportal` | 🟩 | Nachrichten + Portale |

---

## 4) Lücken & Sackgassen (Zusammenfassung)
**🟥 Echte Lücken (fehlt):**
1. **Automatischer Mail-Eingang** in die Suite (Ingest).
2. **Mail → Projekt/Angebot**: 100 % Handarbeit.
3. **Zahlungseingang-Tracking** (Soll/Ist, offene Posten).
4. **KI-Angebots-Assistent** (Anfrage → Angebotsentwurf).
5. **Kalender-Sync**: nur `kalender_export` (iCal-Export) vorhanden, **kein** Live-Sync (z. B. Google).

**🟨 Schwachstellen/Doppelungen (Aufräum-Kandidaten — separater Audit):**
- `module_rechnungen/routes_v1.py` **und** `routes_v2.py` parallel.
- `module_kundenportal` **+** `module_portal_v2_backup`.
- `_archiv`-Ordner (frontend 28 Dateien + backend).
- 117 `TODO/FIXME/deprecated`-Marker im aktiven Code.

---

## 5) Empfehlung (Reihenfolge)
1. **Aktuelle Fehler** abschließen (laufend).
2. **Dashboard** als „Cockpit" über diesen Ablauf neu aufbauen (vorgemerkt, Aufgabe `95b4b4e8…`).
3. **Option B – direkter Mailversand (Jimdo-SMTP)** → schließt Schritt „Versand/Kommunikation".
4. **Zahlungseingang-Tracking** (Schritt 11) – größte echte Lücke fürs Rechnungswesen.
5. **Architektur-Audit `ARCHITEKTUR_AUDIT.md`** → Doppelsysteme/Leichen sauber abbauen (nur mit Einzel-Freigabe + DB-Snapshot, Regel 5).

> **Wichtig (Regel 5/12):** Dies ist reine **Bestandsaufnahme**. Es wurde **nichts geändert/gelöscht**. Aufräumen erst nach deiner ausdrücklichen Einzel-Freigabe + Snapshot.
