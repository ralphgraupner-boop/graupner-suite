from fastapi import APIRouter, HTTPException, Depends
from database import db, logger
from auth import get_current_user
from datetime import datetime, timezone
from uuid import uuid4

router = APIRouter()

VALID_DOC_TYPES = ["angebot", "auftrag", "rechnung", "kundenportal", "einsatz", "termin", "aufgabe", "aufgaben_kategorie", "reparaturgruppe", "material", "prioritaet", "bild_kategorie", "abschlussgrund", "kunden_status", "kunden_kategorie", "kunden_typ", "anrede", "allgemein", "projekt_status", "projekt_kategorie", "projekt_bild_kategorie", "projekt_titel", "aufgabe_titel", "termin_titel", "einsatz_betreff"]
VALID_TEXT_TYPES = ["vortext", "schlusstext", "betreff", "bemerkung", "titel", "email", "mahnung", "portal_nachricht", "abschluss_grund"]

# Doc-Types, deren Eintrag selbst eine Auswahl-Option ist (Titel = Wert).
# Für diese darf der Match-Endpoint keywords-Vorschläge liefern.
SELECTION_DOC_TYPES = {
    "kunden_status", "kunden_kategorie", "kunden_typ", "anrede", "aufgaben_kategorie",
    "abschlussgrund", "reparaturgruppe", "material", "prioritaet",
    "bild_kategorie", "projekt_status", "projekt_kategorie",
    "projekt_bild_kategorie", "projekt_titel",
    "aufgabe_titel", "termin_titel", "einsatz_betreff",
}

PLACEHOLDERS = [
    {"alias": "{anrede_brief}", "beschreibung": "Sehr geehrter Herr/Sehr geehrte Frau + Name"},
    {"alias": "{kunde_name}", "beschreibung": "Name des Kunden"},
    {"alias": "{kunde_adresse}", "beschreibung": "Adresse des Kunden"},
    {"alias": "{kunde_email}", "beschreibung": "E-Mail des Kunden"},
    {"alias": "{kunde_telefon}", "beschreibung": "Telefon des Kunden"},
    {"alias": "{firma}", "beschreibung": "Ihr Firmenname"},
    {"alias": "{datum}", "beschreibung": "Heutiges Datum"},
    {"alias": "{dokument_nr}", "beschreibung": "Dokument-Nummer"},
]

TEXTVORLAGEN_MODUL = {
    "name": "Textvorlagen",
    "slug": "textvorlagen",
    "version": "1.0.0",
    "description": "Eigenstaendiges Modul fuer Textbausteine. Verwaltet Vortext, Schlusstext, Betreff und weitere Vorlagen fuer Dokumente.",
    "status": "aktiv",
    "category": "daten",
    "data_collection": "module_textvorlagen",
    "fields": [
        {"name": "title", "type": "text", "label": "Titel/Name", "required": True},
        {"name": "content", "type": "textarea", "label": "Inhalt", "required": True},
        {"name": "doc_type", "type": "select", "label": "Dokumenttyp", "options": VALID_DOC_TYPES, "required": True},
        {"name": "text_type", "type": "select", "label": "Textart", "options": VALID_TEXT_TYPES, "required": True},
    ],
    "api_endpoints": [
        {"method": "GET", "path": "/api/modules/textvorlagen/data", "description": "Alle Textvorlagen"},
        {"method": "POST", "path": "/api/modules/textvorlagen/data", "description": "Neue Vorlage erstellen"},
        {"method": "PUT", "path": "/api/modules/textvorlagen/data/{id}", "description": "Vorlage bearbeiten"},
        {"method": "DELETE", "path": "/api/modules/textvorlagen/data/{id}", "description": "Vorlage loeschen"},
        {"method": "GET", "path": "/api/modules/textvorlagen/placeholders", "description": "Verfuegbare Platzhalter"},
        {"method": "GET", "path": "/api/modules/textvorlagen/export", "description": "Alle Daten exportieren"},
    ],
}


async def ensure_modul_registered():
    existing = await db.modules.find_one({"slug": "textvorlagen"})
    if not existing:
        from routes.modules import ModuleSchema
        modul = ModuleSchema(**TEXTVORLAGEN_MODUL)
        await db.modules.insert_one(modul.model_dump())
        logger.info("Textvorlagen-Modul registriert")


@router.get("/modules/textvorlagen/data")
async def get_textvorlagen(doc_type: str = "", text_type: str = "", user=Depends(get_current_user)):
    await ensure_modul_registered()
    # Auto-Seed Aufgaben-Kategorien bei erstem Aufruf (idempotent)
    if doc_type == "aufgaben_kategorie":
        await ensure_aufgaben_kategorien_seeded()
    query = {}
    if text_type:
        query["text_type"] = text_type
    shared_types = {"vortext", "schlusstext", "betreff"}
    if doc_type and text_type not in shared_types:
        query["doc_type"] = doc_type
    items = await db.module_textvorlagen.find(query, {"_id": 0}).sort("title", 1).to_list(500)
    return items


@router.get("/modules/textvorlagen/placeholders")
async def get_placeholders(user=Depends(get_current_user)):
    return PLACEHOLDERS


@router.post("/modules/textvorlagen/data")
async def create_textvorlage(data: dict, user=Depends(get_current_user)):
    # Auswahlfeld-Typen brauchen keinen Inhalt — der Titel IST die Auswahl
    if not data.get("title"):
        raise HTTPException(400, "Titel erforderlich")
    if data.get("doc_type") not in SELECTION_DOC_TYPES and not data.get("content"):
        raise HTTPException(400, "Inhalt erforderlich")
    if data.get("doc_type") not in VALID_DOC_TYPES:
        raise HTTPException(400, f"doc_type muss einer von {VALID_DOC_TYPES} sein")
    if data.get("text_type") not in VALID_TEXT_TYPES:
        raise HTTPException(400, f"text_type muss einer von {VALID_TEXT_TYPES} sein")
    item = {
        "id": str(uuid4()),
        "title": data["title"],
        "content": data.get("content", ""),
        "doc_type": data["doc_type"],
        "text_type": data["text_type"],
        "keywords": _normalize_keywords(data.get("keywords")),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.module_textvorlagen.insert_one(item)
    item.pop("_id", None)
    return item


@router.put("/modules/textvorlagen/data/{item_id}")
async def update_textvorlage(item_id: str, data: dict, user=Depends(get_current_user)):
    existing = await db.module_textvorlagen.find_one({"id": item_id})
    if not existing:
        raise HTTPException(404, "Nicht gefunden")
    update = {k: v for k, v in data.items() if k in ("title", "content", "doc_type", "text_type") and v is not None}
    if "keywords" in data:
        update["keywords"] = _normalize_keywords(data.get("keywords"))
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.module_textvorlagen.update_one({"id": item_id}, {"$set": update})
    updated = await db.module_textvorlagen.find_one({"id": item_id}, {"_id": 0})
    return updated


@router.delete("/modules/textvorlagen/data/{item_id}")
async def delete_textvorlage(item_id: str, user=Depends(get_current_user)):
    result = await db.module_textvorlagen.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Nicht gefunden")
    return {"message": "Geloescht"}


@router.get("/modules/textvorlagen/export")
async def export_textvorlagen(doc_type: str = "", text_type: str = "", user=Depends(get_current_user)):
    """Exportiert Textvorlagen als JSON. Optional gefiltert per Query-Parameter,
    damit der User nur die gerade gefilterte Auswahl exportieren kann."""
    q = {}
    if doc_type:
        q["doc_type"] = doc_type
    if text_type:
        q["text_type"] = text_type
    items = await db.module_textvorlagen.find(q, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "textvorlagen"}, {"_id": 0})
    return {
        "module": modul,
        "data": items,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "filter": {"doc_type": doc_type or None, "text_type": text_type or None},
    }


@router.post("/modules/textvorlagen/export-email")
async def export_email(payload: dict, user=Depends(get_current_user)):
    """Sendet den Export als JSON-Anhang an die angegebene E-Mail-Adresse.
    Body: { to: str, doc_type?: str, text_type?: str }
    """
    import json as _json
    from utils import send_email
    to = (payload.get("to") or "").strip()
    if not to or "@" not in to:
        raise HTTPException(400, "Empfänger-E-Mail fehlt")
    q = {}
    if payload.get("doc_type"):
        q["doc_type"] = payload["doc_type"]
    if payload.get("text_type"):
        q["text_type"] = payload["text_type"]
    items = await db.module_textvorlagen.find(q, {"_id": 0}).to_list(10000)
    modul = await db.modules.find_one({"slug": "textvorlagen"}, {"_id": 0})
    export_obj = {
        "module": modul,
        "data": items,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "count": len(items),
        "filter": {"doc_type": payload.get("doc_type") or None, "text_type": payload.get("text_type") or None},
    }
    blob = _json.dumps(export_obj, ensure_ascii=False, indent=2).encode("utf-8")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    suffix = f"_{payload.get('doc_type')}" if payload.get("doc_type") else (f"_{payload.get('text_type')}" if payload.get("text_type") else "")
    filename = f"textvorlagen{suffix}_{today}.json"
    body_html = (
        f"<p>Hallo,</p>"
        f"<p>im Anhang findest Du den Export aus Graupner Suite:</p>"
        f"<ul>"
        f"<li><b>Anzahl:</b> {len(items)} Vorlagen</li>"
        f"<li><b>Filter:</b> {payload.get('doc_type') or '–'} / {payload.get('text_type') or '–'}</li>"
        f"<li><b>Datum:</b> {today}</li>"
        f"</ul>"
        f"<p>Beste Grüße<br>Graupner Suite</p>"
    )
    try:
        send_email(
            to_email=to,
            subject=f"Textvorlagen-Export ({len(items)}) – {today}",
            body_html=body_html,
            attachments=[{"filename": filename, "data": blob}],
        )
    except Exception as exc:
        logger.error(f"Export-Mail fehlgeschlagen: {exc}")
        raise HTTPException(500, f"Mail-Versand fehlgeschlagen: {exc}")
    return {"ok": True, "to": to, "count": len(items), "filename": filename}


def _normalize_import_item(raw: dict) -> dict | None:
    """Validiert+normalisiert einen einzelnen Import-Eintrag. Gibt None zurück,
    wenn der Eintrag unbrauchbar ist (z.B. fehlender Titel/Doc-Type).
    Erlaubt minimale Datensaetze (Titel allein bei Auswahl-Typen).
    """
    title = (raw.get("title") or "").strip()
    doc_type = (raw.get("doc_type") or "").strip()
    text_type = (raw.get("text_type") or "titel").strip()
    content = raw.get("content") or ""
    if not title or not doc_type:
        return None
    if doc_type not in VALID_DOC_TYPES:
        return None
    if text_type not in VALID_TEXT_TYPES:
        return None
    return {"title": title, "doc_type": doc_type, "text_type": text_type, "content": content}


@router.post("/modules/textvorlagen/import-preview")
async def import_preview(payload: dict, user=Depends(get_current_user)):
    """Pruefung vor Import: liefert pro Eintrag den Match-Status:
       neu | konflikt | invalid
    Frontend zeigt das im Vorschau-Dialog mit Checkboxen.
    Body: { items: [...] }  -- akzeptiert flaches Array oder Export-Format mit `data`.
    """
    raw_items = payload.get("items") or payload.get("data") or []
    if not isinstance(raw_items, list):
        raise HTTPException(400, "items muss ein Array sein")
    out = []
    for idx, raw in enumerate(raw_items):
        norm = _normalize_import_item(raw)
        if not norm:
            out.append({
                "key": idx,
                "status": "invalid",
                "title": (raw or {}).get("title") or "(ohne Titel)",
                "doc_type": (raw or {}).get("doc_type") or "",
                "text_type": (raw or {}).get("text_type") or "",
                "content": (raw or {}).get("content") or "",
                "reason": "Pflichtfelder fehlen oder Typ unbekannt",
            })
            continue
        existing = await db.module_textvorlagen.find_one(
            {"title": norm["title"], "doc_type": norm["doc_type"]},
            {"_id": 0, "id": 1, "content": 1, "text_type": 1},
        )
        out.append({
            "key": idx,
            "status": "konflikt" if existing else "neu",
            "title": norm["title"],
            "doc_type": norm["doc_type"],
            "text_type": norm["text_type"],
            "content": norm["content"],
            "existing_id": existing.get("id") if existing else None,
            "existing_text_type": existing.get("text_type") if existing else None,
            "existing_content": existing.get("content") if existing else None,
        })
    return {"items": out, "summary": {
        "neu": sum(1 for x in out if x["status"] == "neu"),
        "konflikt": sum(1 for x in out if x["status"] == "konflikt"),
        "invalid": sum(1 for x in out if x["status"] == "invalid"),
    }}


@router.post("/modules/textvorlagen/import")
async def import_apply(payload: dict, user=Depends(get_current_user)):
    """Fuehrt den Import durch.
    Body:
      {
        "items": [...],            # gleiche Struktur wie Vorschau-Input
        "selected_keys": [0,1,3],  # Indizes welche importiert werden sollen
        "overwrite": false         # bei Konflikten: true=ueberschreiben, false=ueberspringen
      }
    """
    raw_items = payload.get("items") or payload.get("data") or []
    selected = set(payload.get("selected_keys") or list(range(len(raw_items))))
    overwrite = bool(payload.get("overwrite", False))
    if not isinstance(raw_items, list):
        raise HTTPException(400, "items muss ein Array sein")
    now = datetime.now(timezone.utc).isoformat()
    inserted = 0
    updated = 0
    skipped = 0
    invalid = 0
    for idx, raw in enumerate(raw_items):
        if idx not in selected:
            skipped += 1
            continue
        norm = _normalize_import_item(raw)
        if not norm:
            invalid += 1
            continue
        existing = await db.module_textvorlagen.find_one(
            {"title": norm["title"], "doc_type": norm["doc_type"]}, {"_id": 0, "id": 1},
        )
        if existing:
            if not overwrite:
                skipped += 1
                continue
            await db.module_textvorlagen.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "content": norm["content"],
                    "text_type": norm["text_type"],
                    "updated_at": now,
                }},
            )
            updated += 1
        else:
            await db.module_textvorlagen.insert_one({
                "id": str(uuid4()),
                "title": norm["title"],
                "doc_type": norm["doc_type"],
                "text_type": norm["text_type"],
                "content": norm["content"],
                "created_at": now,
                "updated_at": now,
            })
            inserted += 1
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "invalid": invalid,
        "total": len(raw_items),
    }


# Standard-Vorlagen fuer das Kundenportal (werden per Seed-Endpoint eingespielt)
STANDARD_PORTAL_VORLAGEN = [
    {
        "title": "Begruessung + Bilder-Anfrage",
        "doc_type": "kundenportal",
        "text_type": "portal_nachricht",
        "content": (
            "{anrede_brief},\n\n"
            "vielen Dank fuer Ihr Vertrauen und die Beauftragung unserer Tischlerei.\n\n"
            "Damit wir Ihren Auftrag optimal vorbereiten koennen, bitten wir Sie, uns ueber das Kundenportal einige Bilder der aktuellen Situation vor Ort hochzuladen (z.B. Tuer, Fenster, Raumsituation, Detailaufnahmen).\n\n"
            "Sie koennen die Bilder einfach ueber den Upload-Button im Portal hochladen. So sparen wir uns gegenseitig Wege und koennen zuegig mit der Planung starten.\n\n"
            "Vielen Dank und freundliche Gruesse\nIhre Tischlerei Graupner"
        ),
    },
    {
        "title": "Weitere Bilder benoetigt",
        "doc_type": "kundenportal",
        "text_type": "portal_nachricht",
        "content": (
            "{anrede_brief},\n\n"
            "vielen Dank fuer die bereits hochgeladenen Bilder. Fuer eine praezise Planung benoetigen wir noch zusaetzliche Aufnahmen:\n\n"
            "- Gesamtansicht des Bereichs\n- Detail-/Nahaufnahmen der betroffenen Stellen\n- ggf. Massangaben (mit Zollstock sichtbar)\n\n"
            "Bitte laden Sie die weiteren Bilder ueber das Kundenportal hoch. Bei Fragen melden Sie sich gerne.\n\n"
            "Freundliche Gruesse\nIhre Tischlerei Graupner"
        ),
    },
    {
        "title": "Rueckfrage / Eigene Frage",
        "doc_type": "kundenportal",
        "text_type": "portal_nachricht",
        "content": (
            "{anrede_brief},\n\n"
            "zu Ihrem Auftrag haetten wir noch eine kurze Rueckfrage:\n\n"
            "[Hier Ihre Frage einfuegen]\n\n"
            "Bitte antworten Sie uns einfach ueber das Kundenportal oder per E-Mail. Vielen Dank!\n\n"
            "Freundliche Gruesse\nIhre Tischlerei Graupner"
        ),
    },
]


@router.post("/modules/textvorlagen/seed-kundenportal")
async def seed_kundenportal_vorlagen(user=Depends(get_current_user)):
    """Legt die 3 Standard-Kundenportal-Vorlagen an, falls sie noch nicht existieren.
    Idempotent: vorhandene Vorlagen (Match ueber title + doc_type) werden NICHT ueberschrieben.
    """
    await ensure_modul_registered()
    inserted = 0
    skipped = 0
    results = []
    for v in STANDARD_PORTAL_VORLAGEN:
        existing = await db.module_textvorlagen.find_one({
            "title": v["title"],
            "doc_type": v["doc_type"],
        })
        if existing:
            skipped += 1
            results.append({"title": v["title"], "status": "existiert bereits"})
            continue
        item = {
            "id": str(uuid4()),
            "title": v["title"],
            "content": v["content"],
            "doc_type": v["doc_type"],
            "text_type": v["text_type"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.module_textvorlagen.insert_one(item)
        inserted += 1
        results.append({"title": v["title"], "status": "neu angelegt"})
    return {
        "inserted": inserted,
        "skipped": skipped,
        "total": len(STANDARD_PORTAL_VORLAGEN),
        "details": results,
    }


STANDARD_AUFGABEN_VORLAGEN = [
    {"title": "Aufmaß vor Ort", "content": "Aufmaß beim Kunden durchführen. Fotos machen, Skizze anfertigen, alle Maße notieren (Höhe, Breite, Tiefe, Besonderheiten).", "doc_type": "aufgabe", "text_type": "titel"},
    {"title": "Fotos Bestand machen", "content": "Vor Beginn der Arbeiten Bestandsfotos aller betroffenen Bereiche machen. Nahaufnahmen von Details und Übersichtsfotos.", "doc_type": "aufgabe", "text_type": "titel"},
    {"title": "Werkzeug prüfen/zusammenstellen", "content": "Werkzeugkiste auf Vollständigkeit prüfen. Akkus geladen? Verbrauchsmaterial (Schrauben, Dübel, Silikon) ausreichend?", "doc_type": "aufgabe", "text_type": "titel"},
    {"title": "Materiallieferung annehmen", "content": "Lieferung auf Vollständigkeit und Beschädigungen prüfen. Lieferschein abzeichnen. Ware ordentlich einlagern.", "doc_type": "aufgabe", "text_type": "titel"},
    {"title": "Rechnung stellen", "content": "Nach Abschluss der Arbeiten Rechnung erstellen. Arbeitszeit, Material und ggf. Fahrtkosten erfassen.", "doc_type": "aufgabe", "text_type": "titel"},
]


@router.post("/modules/textvorlagen/seed-aufgaben")
async def seed_aufgaben_vorlagen(user=Depends(get_current_user)):
    """Legt Standard-Aufgaben-Vorlagen an, falls noch nicht vorhanden (idempotent)."""
    await ensure_modul_registered()
    inserted = 0
    skipped = 0
    results = []
    for v in STANDARD_AUFGABEN_VORLAGEN:
        existing = await db.module_textvorlagen.find_one({
            "title": v["title"],
            "doc_type": v["doc_type"],
        })
        if existing:
            skipped += 1
            results.append({"title": v["title"], "status": "existiert bereits"})
            continue
        item = {
            "id": str(uuid4()),
            "title": v["title"],
            "content": v["content"],
            "doc_type": v["doc_type"],
            "text_type": v["text_type"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.module_textvorlagen.insert_one(item)
        inserted += 1
        results.append({"title": v["title"], "status": "neu angelegt"})
    return {
        "inserted": inserted,
        "skipped": skipped,
        "total": len(STANDARD_AUFGABEN_VORLAGEN),
        "details": results,
    }


# Aufgaben-Kategorien sind reine User-Daten in module_textvorlagen
# (doc_type=aufgaben_kategorie). Beim allerersten Aufruf werden bestehende
# Werte aus module_aufgaben einmalig migriert. Wenn die DB komplett leer
# ist, wird "Sonstige" als minimaler Eintrag angelegt — kein Hardcoding
# weiterer Defaults (siehe VISION.md, Modul-First / Datenmasken-Regel).


async def ensure_aufgaben_kategorien_seeded():
    """Idempotent: einmalig Werte aus module_aufgaben migrieren."""
    has_any = await db.module_textvorlagen.find_one({"doc_type": "aufgaben_kategorie"})
    if has_any:
        return
    titles: set[str] = set()
    async for a in db.module_aufgaben.find(
        {"kategorie": {"$exists": True, "$nin": [None, ""]}},
        {"_id": 0, "kategorie": 1},
    ):
        v = (a.get("kategorie") or "").strip()
        if v:
            titles.add(v)
    if not titles:
        titles = {"Sonstige"}
    now = datetime.now(timezone.utc).isoformat()
    for t in titles:
        await db.module_textvorlagen.insert_one({
            "id": str(uuid4()),
            "title": t,
            "content": "",
            "doc_type": "aufgaben_kategorie",
            "text_type": "titel",
            "created_at": now,
            "updated_at": now,
        })


# ===================== Keywords + Match-Engine =====================

import re as _re


def _normalize_keywords(raw) -> list[str]:
    """Akzeptiert Liste oder Komma-getrennten String, normalisiert auf
    saubere Strings (gestripped, ohne leere Einträge, kleingeschrieben für
    Match — Display bleibt user-getippt)."""
    if raw is None:
        return []
    if isinstance(raw, str):
        parts = [p.strip() for p in raw.split(",")]
    elif isinstance(raw, list):
        parts = [str(p).strip() for p in raw]
    else:
        return []
    return [p for p in parts if p]


def _tokenize_text(text: str) -> str:
    """Bereitet Text fürs Matching vor: lowercase + Whitespace normalisieren."""
    return _re.sub(r"\s+", " ", (text or "").lower()).strip()


def _count_keyword_hits(keyword: str, text: str) -> tuple[int, str | None]:
    """Zählt Vorkommen eines Keywords im Text (case-insensitive Substring-Match).

    Substring-Match passt gut zu deutschen Komposita: Stichwort "schiebetür"
    matcht in "Schiebetür" und "Hebeschiebetür". Mehrwort-Phrasen werden als
    Ganzes gesucht (Whitespace-Folgen werden zuvor durch _tokenize_text auf
    einzelne Spaces normalisiert).

    Rückgabe: (treffer_anzahl, normalisiertes_keyword) bzw. (0, None).
    """
    kw = (keyword or "").strip().lower()
    if not kw:
        return 0, None
    pattern = _re.escape(kw)
    matches = _re.findall(pattern, text, flags=_re.IGNORECASE)
    return len(matches), kw if matches else None


@router.post("/modules/textvorlagen/match")
async def match_textvorlage(payload: dict, user=Depends(get_current_user)):
    """Matched einen Freitext gegen die ``keywords`` der Textvorlagen eines
    bestimmten ``doc_type`` und liefert die treffer-stärkste Vorlage als
    Vorschlag.

    Body: ``{ text: str, doc_type: str, top_n?: int = 3 }``

    Antwort:
    ```
    {
      "doc_type": "projekt_kategorie",
      "best": { id, title, content, keywords, hits, matched_terms } | null,
      "candidates": [ ... ],   # nach hits absteigend, max top_n
      "tied": bool             # true wenn 2+ Kandidaten gleichauf liegen
    }
    ```
    """
    text = (payload or {}).get("text") or ""
    doc_type = ((payload or {}).get("doc_type") or "").strip()
    top_n = int((payload or {}).get("top_n") or 3)
    if not doc_type:
        raise HTTPException(400, "doc_type erforderlich")
    if doc_type not in VALID_DOC_TYPES:
        raise HTTPException(400, f"Unbekannter doc_type: {doc_type}")

    norm_text = _tokenize_text(text)
    candidates = []
    async for v in db.module_textvorlagen.find(
        {"doc_type": doc_type, "keywords": {"$exists": True, "$ne": []}},
        {"_id": 0},
    ):
        kws = v.get("keywords") or []
        total_hits = 0
        matched_terms: list[str] = []
        for kw in kws:
            hits, term = _count_keyword_hits(kw, norm_text)
            if hits > 0 and term:
                total_hits += hits
                matched_terms.append(term)
        if total_hits > 0:
            candidates.append({
                "id": v.get("id"),
                "title": v.get("title"),
                "content": v.get("content") or "",
                "keywords": kws,
                "hits": total_hits,
                "matched_terms": matched_terms,
            })
    candidates.sort(key=lambda c: (-c["hits"], c["title"]))
    top = candidates[:max(1, top_n)]
    best = top[0] if top else None
    tied = bool(best and len(top) >= 2 and top[0]["hits"] == top[1]["hits"])
    return {
        "doc_type": doc_type,
        "best": None if tied else best,
        "candidates": top,
        "tied": tied,
    }


# ===================== Seed: Projekt-Auswahllisten =====================

STANDARD_PROJEKT_KATEGORIEN = [
    {"title": "Schiebetür", "content": "Schiebetür-Reparatur",
     "keywords": ["schiebetür", "schiebetuer", "fliegengitter", "schiebt nicht", "rahmen verzogen", "faltschiebetür"]},
    {"title": "Fenster", "content": "Fenster-Reparatur",
     "keywords": ["fenster", "küchenfenster", "schließt nicht", "schliesst nicht", "undicht", "fensterflügel", "fensterfluegel"]},
    {"title": "Haustür", "content": "Haustür-Reparatur",
     "keywords": ["haustür", "haustuer", "eingangstür", "eingangstuer", "schloss", "einbruch", "wohnungstür", "wohnungstuer"]},
    {"title": "Innentür", "content": "Innentür-Reparatur",
     "keywords": ["innentür", "innentuer", "zimmertür", "zimmertuer", "zarge", "türblatt", "tuerblatt", "schleift"]},
    {"title": "Terrassentür", "content": "Terrassentür-Reparatur",
     "keywords": ["terrassentür", "terrassentuer", "balkontür", "balkontuer", "hebeschiebetür"]},
    {"title": "Sonstiges", "content": "",
     "keywords": []},
]

STANDARD_PROJEKT_STATUS = [
    {"title": "Anfrage"}, {"title": "In Bearbeitung"},
    {"title": "Abgeschlossen"}, {"title": "Archiv"},
]

STANDARD_PROJEKT_BILD_KATEGORIEN = [
    {"title": "vorher"}, {"title": "schaden"},
    {"title": "nachher"}, {"title": "sonstiges"},
]


STANDARD_ANREDEN = [{"title": "Herr"}, {"title": "Frau"}, {"title": "Divers"}]
STANDARD_KUNDEN_TYPEN = [
    {"title": "Privat"}, {"title": "Firma"}, {"title": "Vermieter"},
    {"title": "Mieter"}, {"title": "Gewerblich"}, {"title": "Hausverwaltung"},
]


@router.post("/modules/textvorlagen/seed-kunden-auswahl")
async def seed_kunden_auswahl(user=Depends(get_current_user)):
    """Idempotenter Seed für Anrede + Kundentyp.
    Wird selten manuell aufgerufen; eher beim Initial-Setup oder nach Upgrade.
    Bestehende Einträge werden nicht überschrieben."""
    await ensure_modul_registered()
    now = datetime.now(timezone.utc).isoformat()
    inserted, skipped = 0, 0
    for doc_type, items in [("anrede", STANDARD_ANREDEN), ("kunden_typ", STANDARD_KUNDEN_TYPEN)]:
        for v in items:
            ex = await db.module_textvorlagen.find_one({"title": v["title"], "doc_type": doc_type})
            if ex:
                skipped += 1
                continue
            await db.module_textvorlagen.insert_one({
                "id": str(uuid4()),
                "title": v["title"],
                "content": "",
                "doc_type": doc_type,
                "text_type": "titel",
                "keywords": [],
                "created_at": now,
                "updated_at": now,
            })
            inserted += 1
    return {"inserted": inserted, "skipped": skipped}


@router.post("/modules/textvorlagen/seed-projekt")
async def seed_projekt_vorlagen(user=Depends(get_current_user)):
    """Idempotenter Seed für die Projekt-Auswahllisten (Status, Kategorien,
    Bild-Kategorien) inkl. initialer Keywords für die Auto-Klassifikation.
    Bestehende Einträge werden nicht überschrieben."""
    await ensure_modul_registered()
    now = datetime.now(timezone.utc).isoformat()
    inserted = 0
    skipped = 0
    details = []

    plans = [
        ("projekt_kategorie", STANDARD_PROJEKT_KATEGORIEN, "titel"),
        ("projekt_status", STANDARD_PROJEKT_STATUS, "titel"),
        ("projekt_bild_kategorie", STANDARD_PROJEKT_BILD_KATEGORIEN, "titel"),
    ]
    for doc_type, items, text_type in plans:
        for v in items:
            existing = await db.module_textvorlagen.find_one(
                {"title": v["title"], "doc_type": doc_type}
            )
            if existing:
                skipped += 1
                details.append({"doc_type": doc_type, "title": v["title"], "status": "existiert bereits"})
                # Keywords nachpflegen, falls leer (defensive Nachrüstung)
                if v.get("keywords") and not (existing.get("keywords") or []):
                    await db.module_textvorlagen.update_one(
                        {"id": existing["id"]},
                        {"$set": {"keywords": _normalize_keywords(v["keywords"]), "updated_at": now}},
                    )
                    details[-1]["status"] = "keywords nachgepflegt"
                continue
            await db.module_textvorlagen.insert_one({
                "id": str(uuid4()),
                "title": v["title"],
                "content": v.get("content", ""),
                "doc_type": doc_type,
                "text_type": text_type,
                "keywords": _normalize_keywords(v.get("keywords")),
                "created_at": now,
                "updated_at": now,
            })
            inserted += 1
            details.append({"doc_type": doc_type, "title": v["title"], "status": "neu angelegt"})

    return {"inserted": inserted, "skipped": skipped, "details": details}

