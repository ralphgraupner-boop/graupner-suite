# Dokumente — Modul-Abhängigkeitsgraph

> Begleit-Diagramm zu `DOKUMENTE_ARCHITEKTUR.md`. Bild liegt parallel als
> `DOKUMENTE_MODULE_GRAPH.svg` im selben Ordner.

```mermaid
flowchart TB
    %% ──────────────── Frontend ────────────────
    subgraph FE["📱 Frontend (React)"]
        WRAP[DokumenteModulPage<br/>/module/dokumente]
        Q[QuotesPage]
        O[OrdersPage]
        I[InvoicesPage]
        T[DocumentTemplatesPanel]
        E[WysiwygDocumentEditor<br/>Editor für alle Doc-Arten]
        WRAP --> Q
        WRAP --> O
        WRAP --> I
        WRAP --> T
    end

    %% ──────────────── Module ────────────────
    subgraph BE["⚙️ Backend Module (Module-First)"]
        MA[module_angebote/<br/>routes.py<br/>/api/quotes/*]
        MB[module_auftraege/<br/>routes.py<br/>/api/orders/*]
        MR[module_rechnungen/<br/>routes_v1 + v2<br/>/api/invoices/*]
        MD[module_dokumente/<br/>4 Sub-Routen<br/>/api/document-templates/*]
    end

    %% ──────────────── Cross-Module Helpers ────────────────
    subgraph HELP["🔧 Querschnittsmodule"]
        MK[module_kunden<br/>find_customer_in_modules]
        MT[module_textvorlagen<br/>doc_type=angebot/auftrag/rechnung]
        AR[routes/articles.py]
        LB[routes/leistungsbloecke.py]
        TT[routes/text_templates.py<br/>Mahn-Texte]
        PDF[routes/pdf.py<br/>PDF-Erzeugung]
        EM[routes/email.py<br/>send_email]
    end

    %% ──────────────── DB ────────────────
    subgraph DB["🗄️ MongoDB Collections"]
        DBQ[(quotes)]
        DBO[(orders)]
        DBI[(invoices)]
        DBT[(document_templates)]
        DBA[(articles)]
        DBL[(leistungsbloecke)]
        DBMT[(module_textvorlagen)]
        DBK[(module_kunden)]
        DBS[(settings)]
        DBV2[(module_dokumente_v2_*<br/>SANDBOX)]
    end

    %% Frontend ↔ Module
    Q --> MA
    O --> MB
    I --> MR
    T --> MD
    E --> MA
    E --> MB
    E --> MR

    %% Workflow-Ketten
    MA -.->|Angebot → Auftrag<br/>POST /orders/from-quote| MB
    MB -.->|Auftrag → Rechnung<br/>POST /invoices/from-order| MR
    MR -.->|Mahnstufen<br/>POST /invoices/:id/dunning| EM

    %% Helpers
    MA --> MK
    MB --> MK
    MR --> MK
    MA --> MT
    MB --> MT
    MR --> MT
    MA --> AR
    MA --> LB
    MR --> TT
    MA --> PDF
    MB --> PDF
    MR --> PDF

    %% DB
    MA --> DBQ
    MB --> DBO
    MR --> DBI
    MD --> DBT
    AR --> DBA
    LB --> DBL
    MT --> DBMT
    MK --> DBK
    PDF --> DBS

    classDef sandbox fill:#fef9c3,stroke:#a16207,stroke-dasharray:5 3
    class DBV2 sandbox
```

## Lese-Hilfe

| Symbol | Bedeutung |
|---|---|
| Pfeil **durchgezogen** | Direkter API-Aufruf oder Datenbank-Schreibzugriff |
| Pfeil **gestrichelt** | Workflow-Kette (ein Dokument erzeugt das nächste) |
| Pfeil **gepunktet** | Hilfsbeziehung (Validierung, Lookup) |
| Gelb gestrichelt | Sandbox / nicht produktiv |

## Was sagt mir das Bild?

1. **Eine Seite, vier Backends** — der Tab-Wrapper `DokumenteModulPage` schickt
   jeden Tab in genau ein Modul. Das ist kein Spaghetti-Code, sondern saubere
   Trennung pro Datenobjekt.

2. **Drei produktive Workflow-Ketten** sind klar erkennbar:
   - Angebot → Auftrag (Status-Übergang per Button)
   - Auftrag → Rechnung
   - Rechnung → Mahnung (3 Stufen, Mail-Versand integriert)

3. **`module_textvorlagen` ist das Rückgrat** — alle Auswahllisten
   (Betreff-Vorschläge, Status-Werte, Mahn-Stufen-Texte) hängen daran.
   Ändert man dort etwas, ändert sich das Verhalten in **allen** drei Modulen
   gleichzeitig — ohne Code-Änderung.

4. **Sandbox `module_dokumente_v2_*`** ist von keinem produktiven Modul
   verbunden. Dort ist Daten zu verlieren risikofrei, aber dort etwas zu
   bauen wird auch keinem Endkunden helfen, bis eine Migration gebaut wird.

## Wenn etwas „leer" wirkt

| Symptom | Wahrscheinliche Ursache |
|---|---|
| Dropdown bei „Betreff" leer | `module_textvorlagen` hat nichts mit `doc_type=angebot` |
| Artikel-Vorschläge fehlen | `articles`-Collection leer |
| Positions-Bündel fehlen | `leistungsbloecke`-Collection leer |
| Briefkopf falsch im PDF | `settings`-Collection nicht gepflegt |
| Mahn-Mail kommt nicht | SMTP-Config in `.env` oder Mahn-Vorlage in `text_templates` fehlt |
