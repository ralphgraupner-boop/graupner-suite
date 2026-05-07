# Dokumente — Modul-Architektur & Zusammenhänge

*Stand: 07.05.2026 — produktiv genutzt: `/module/dokumente`*

---

## TL;DR

**Es gibt zwei parallele Dokumente-Welten.** Sie haben getrennte Datenbanken
und teilen sich nichts. Ralph nutzt die alte produktiv (96 % seiner Daten
sind dort), V2 ist eine Test-Sandbox.

| URL | Status | DB-Collections | Wer nutzt das |
|---|---|---|---|
| `/module/dokumente` | ✅ produktiv (Backup) | `quotes`, `orders`, `invoices`, `document_templates`, `articles`, `leistungsbloecke` | Ralph live |
| `/dokumente-v2` | ⚙️ Sandbox / Test | `module_dokumente_v2_*` | nicht produktiv |

→ **Niemals** den `/dokumente-v2`-Code als Ersatz vermarkten, ohne
vorher eine echte Daten-Migration zu bauen.

---

## Aufbau der produktiven Seite (`/module/dokumente`)

`DokumenteModulPage.jsx` ist nur ein **Tab-Wrapper**. Pro Tab wird eine
eigenständige Page-Komponente eingehängt:

```
┌─────────────────────────── DokumenteModulPage.jsx ────────────────────────┐
│  Tabs: [Angebote] [Aufträge] [Rechnungen] [Vorlagen]                       │
│                                                                            │
│  Angebote-Tab    → QuotesPage.jsx           → Backend module_angebote/    │
│                                                                            │
│  Aufträge-Tab    → OrdersPage.jsx           → Backend module_auftraege/   │
│                                                                            │
│  Rechnungen-Tab  → InvoicesPage.jsx         → Backend module_rechnungen/  │
│                                                                            │
│  Vorlagen-Tab    → DocumentTemplatesPanel   → Backend module_dokumente/   │
│                    (in /components)           (routes_templates.py)         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Backend-Endpunkte pro Tab

| Tab | Frontend-Aufruf | Backend-Modul | Endpunkt |
|---|---|---|---|
| Angebote | `api.get("/quotes")` | `module_angebote/` | `GET /api/quotes` |
| Aufträge | `api.get("/orders")` | `module_auftraege/` | `GET /api/orders` |
| Rechnungen | `api.get("/invoices")` + `/invoices/overdue` | `module_rechnungen/routes_v1.py` | `GET /api/invoices` |
| Vorlagen | `api.get("/document-templates")` | `module_dokumente/routes_templates.py` | `GET /api/document-templates` |
| Stats (Header) | `api.get("/modules/dokumente/stats")` | `module_dokumente/routes_data.py` | `GET /api/modules/dokumente/stats` |
| Export | `api.get("/modules/dokumente/export")` | `module_dokumente/routes_data.py` | `GET /api/modules/dokumente/export` |

---

## Querverbindungen zu anderen Modulen

```
                  ┌────────────────────────────┐
                  │   module_kunden            │
                  │   (Kunde = Source of Truth)│
                  └────────────┬───────────────┘
                               │ kunde_id
                               ▼
                  ┌────────────────────────────┐
                  │   find_customer_in_modules │  (gemeinsamer Helper)
                  │   in module_angebote/      │
                  └────────┬──────┬──────┬─────┘
                           │      │      │
                           ▼      ▼      ▼
                       Angebot → Auftrag → Rechnung
                       (Workflow: jede Stufe per Button)

  Pos.-Vorlagen      ◄──── /api/leistungsbloecke (routes/leistungsbloecke.py)
  Artikel-Vorschläge ◄──── /api/articles          (routes/articles.py)
  Mahn-Texte         ◄──── /api/text-templates?text_type=mahnung  (routes/text_templates.py)
  Auswahlfelder      ◄──── module_textvorlagen   (Datenmaske, Source of Truth)
                          (doc_type=angebot, auftrag, rechnung, …)
  PDF-Erzeugung      ◄──── /api/pdf/quote/:id, /api/pdf/order/:id, /api/pdf/invoice/:id
  Mahnungs-Mail      ◄──── /api/email/dunning/:id (routes/email.py + utils/send_email)
```

### Wichtig: Workflow-Ketten
- **Angebot → Auftrag**: `POST /api/orders/from-quote/{quote_id}` (in `module_auftraege/routes.py`)
- **Auftrag → Rechnung**: `POST /api/invoices/from-order/{order_id}` (in `module_rechnungen/routes_v1.py`)
- **Rechnung → Mahnung**: `POST /api/invoices/{id}/dunning` + `/api/email/dunning/{id}`

Diese Ketten erzeugen **eigene** Datensätze in der jeweils nächsten Collection
(quote → order → invoice). Der Bezug bleibt über `kunde_id` und `source_quote_id`
erhalten.

---

## Welche Datenbank-Collections enthalten was

| Collection | Inhalt | Geschrieben von |
|---|---|---|
| `quotes` | Angebote (Positionen, Beträge, Status) | `module_angebote/routes.py` |
| `orders` | Aufträge | `module_auftraege/routes.py` |
| `invoices` | Rechnungen + Mahnstufen | `module_rechnungen/routes_v1.py` |
| `rechnungen_v2` | Rechnungen Modell v2 (parallel) | `module_rechnungen/routes_v2.py` |
| `document_templates` | Wiederverwendbare Dokument-Vorlagen | `module_dokumente/routes_templates.py` |
| `articles` | Artikelstamm | `routes/articles.py` |
| `leistungsbloecke` | Wiederverwendbare Positions-Bündel | `routes/leistungsbloecke.py` |
| `mitarbeiter` | Stammdaten Mitarbeiter (für PDF-Footer) | `routes/mitarbeiter.py` |
| `settings` | Firmensitz, Briefkopf, Skonti, Mahn-Konfig | `routes/settings.py` |
| `module_dokumente_v2_*` | **Sandbox-Daten** der V2 — getrennt | `dokumente_v2/` |

---

## Was die V2-Welt anders macht (`/dokumente-v2`)

- Ein einziges Modul `dokumente_v2/` mit GoBD-konformen, lückenlosen Nummernkreisen
- Eigene Collections (`module_dokumente_v2_*`), getrennt von den produktiven
- Ein einheitliches Datenmodell für Angebot/Auftrag/Rechnung/Gutschrift
- **Aber:** keine Vorlagen-Verwaltung, kein Mahnwesen, keine PDF-Erzeugung
  über alte Pipeline, keine Workflow-Übernahme aus alten Angeboten
- Status: **technische Vorstudie**, nicht produktiv

→ Wenn V2 produktiv werden soll, muss zuerst:
  1. eine **Daten-Migration** `quotes/orders/invoices` → `module_dokumente_v2_*`
  2. **Mahnwesen** + **Vorlagen** in V2 nachgezogen werden
  3. **PDF-Pipeline** auf das neue Modell umgestellt werden

Bis dahin bleibt `/module/dokumente` der einzige produktive Pfad.

---

## Was wurde durch den Module-First-Refactor (07.05.2026) verändert?

Die **API-Pfade sind unverändert**. Nur die Code-Verzeichnisse haben sich
geändert:

| vorher | jetzt |
|---|---|
| `routes/quotes.py` | `module_angebote/routes.py` |
| `routes/orders.py` | `module_auftraege/routes.py` |
| `routes/invoices.py` | `module_rechnungen/routes_v1.py` |
| `routes/rechnungen_v2.py` | `module_rechnungen/routes_v2.py` |
| `routes/documents.py` | `module_dokumente/routes_legacy.py` |
| `routes/document_templates.py` | `module_dokumente/routes_templates.py` |
| `routes/documents_manager.py` | `module_dokumente/routes_manager.py` |
| `routes/module_dokumente.py` | `module_dokumente/routes_data.py` |

Das Frontend brauchte keine Anpassung.

---

## Bekannte offene Punkte

- `Topkonto`-Vorbild war WYSIWYG-Editor — bereits umgesetzt in
  `WysiwygDocumentEditor.jsx` (Editieren von Angeboten/Aufträgen/Rechnungen).
- Mahnwesen läuft nur über `module_rechnungen/routes_v1.py` (`/api/invoices/{id}/dunning`).
- `routes/leistungsbloecke.py` und `routes/articles.py` liegen noch im alten
  `routes/`-Ordner — Refactor ausstehend, aber kein Bug.
