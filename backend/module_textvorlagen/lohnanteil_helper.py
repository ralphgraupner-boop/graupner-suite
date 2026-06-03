"""§35a Lohnanteil-Hinweis: zentrale Logik fuer Seed, Lookup, Placeholder-Render.

Beide PDF-Generatoren (utils/pdf_generator_v2.py UND dokumente_v2/pdf.py) holen
den Wortlaut aus der Textvorlage 'allgemein/bemerkung/§35a Lohnanteil', damit
Ralph den Text in Einstellungen → Textvorlagen pflegen kann.
"""
from datetime import datetime, timezone
from uuid import uuid4
from database import db, logger


SEED_TITLE = "§35a Lohnanteil"
SEED_DOC_TYPE = "allgemein"
SEED_TEXT_TYPE = "bemerkung"

# Default-Wortlaut (User-Entscheidung 03.06.2026, Headline + Footer integriert)
SEED_CONTENT = (
    "Hinweis § 35a EStG (Steuerbonus Handwerkerleistung):\n"
    "Enthalten ist ein Lohnanteil von € {lohn_netto} zuzüglich {mwst_satz} MwSt. "
    "(= € {lohn_mwst}). Dies ergibt eine Gesamt-Lohnsumme von € {lohn_brutto}.\n"
    "20 % der Arbeitskosten sind als Steuerermäßigung nach § 35a EStG "
    "abzugsfähig (max. 1.200 € pro Jahr)."
)


def _fmt_de(value: float) -> str:
    """1234.5 -> '1.234,50'"""
    try:
        return f"{float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "0,00"


async def ensure_lohnanteil_template_seeded():
    """Idempotent: legt die §35a-Textvorlage an, falls noch nicht vorhanden."""
    try:
        existing = await db.module_textvorlagen.find_one(
            {"doc_type": SEED_DOC_TYPE, "text_type": SEED_TEXT_TYPE, "title": SEED_TITLE},
            {"_id": 0, "id": 1},
        )
        if existing:
            return
        now = datetime.now(timezone.utc).isoformat()
        await db.module_textvorlagen.insert_one({
            "id": str(uuid4()),
            "title": SEED_TITLE,
            "content": SEED_CONTENT,
            "doc_type": SEED_DOC_TYPE,
            "text_type": SEED_TEXT_TYPE,
            "sort_order": 0,
            "created_at": now,
            "updated_at": now,
            "seeded": True,
        })
        logger.info(f"Textvorlage '{SEED_TITLE}' seeded (idempotent).")
    except Exception as e:
        logger.warning(f"Lohnanteil-Seed fehlgeschlagen: {e}")


def _render(template: str, lohn_netto: float, vat_rate: float) -> str:
    """Ersetzt {lohn_netto}/{lohn_mwst}/{lohn_brutto}/{mwst_satz} mit echten Zahlen."""
    lohn_mwst = lohn_netto * (vat_rate / 100)
    lohn_brutto = lohn_netto + lohn_mwst
    return (
        (template or SEED_CONTENT)
        .replace("{lohn_netto}", _fmt_de(lohn_netto))
        .replace("{lohn_mwst}", _fmt_de(lohn_mwst))
        .replace("{lohn_brutto}", _fmt_de(lohn_brutto))
        .replace("{mwst_satz}", f"{vat_rate:.2f}".replace(".", ",") + "%")
        # Rueckwaertskompatible Aliase, falls alte Vorlagen noch existieren
        .replace("{lohnanteil}", _fmt_de(lohn_netto))
        .replace("{lohnanteil_mwst}", _fmt_de(lohn_mwst))
        .replace("{lohnanteil_brutto}", _fmt_de(lohn_brutto))
    )


async def get_lohnanteil_text(lohn_netto: float, vat_rate: float) -> str:
    """Holt die Textvorlage und rendert mit den realen Zahlen.
    Fallback auf SEED_CONTENT, falls die Vorlage nicht existiert."""
    try:
        tpl = await db.module_textvorlagen.find_one(
            {"doc_type": SEED_DOC_TYPE, "text_type": SEED_TEXT_TYPE, "title": SEED_TITLE},
            {"_id": 0, "content": 1},
        )
        content = (tpl or {}).get("content") or SEED_CONTENT
    except Exception as e:
        logger.warning(f"Lohnanteil-Template-Lookup fehlgeschlagen: {e}")
        content = SEED_CONTENT
    return _render(content, lohn_netto, vat_rate)


def get_lohnanteil_text_sync(lohn_netto: float, vat_rate: float) -> str:
    """Sync-Variante fuer reportlab/PDF-Generator, der nicht im async-Context laeuft.
    Greift direkt per pymongo-Sync auf die DB zu (motor liefert hier ein Future)."""
    try:
        from pymongo import MongoClient
        import os
        client = MongoClient(os.environ["MONGO_URL"])
        dbname = os.environ["DB_NAME"]
        tpl = client[dbname]["module_textvorlagen"].find_one(
            {"doc_type": SEED_DOC_TYPE, "text_type": SEED_TEXT_TYPE, "title": SEED_TITLE},
            {"_id": 0, "content": 1},
        )
        content = (tpl or {}).get("content") or SEED_CONTENT
        client.close()
    except Exception as e:
        logger.warning(f"Lohnanteil-Template-Lookup (sync) fehlgeschlagen: {e}")
        content = SEED_CONTENT
    return _render(content, lohn_netto, vat_rate)
