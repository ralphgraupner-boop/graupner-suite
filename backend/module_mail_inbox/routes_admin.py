"""Admin/Wartungs-Routen für module_mail_inbox: Spam-Reevaluierung, DB-Migration."""
from fastapi import APIRouter, Depends, HTTPException
from database import db, logger
from routes.auth import get_current_user
from .parser import parse_anfrage
from .spam_filter import evaluate_spam
from .helpers import _content_hash

router = APIRouter()


@router.post("/reevaluate-spam")
async def reevaluate_spam(user=Depends(get_current_user)):
    """Bewertet alle vorhandenen Mails neu mit dem aktuellen Parser + Spam-Filter.
    - Re-parst body_excerpt mit aktueller Parser-Logik (z.B. neue Jimdo-Formate)
    - Re-evaluiert Spam-Score
    - Mails die übernommen sind bleiben in der DB, ihre `parsed`-Felder werden
      aber aktualisiert (z.B. damit Anrede/Telefon nachträglich korrekt sind).
    - Status (vorschlag ↔ spam_verdacht) wird aktualisiert. Übernommen/Ignoriert
      bleibt unverändert."""
    moved_to_vorschlag = 0
    moved_to_spam = 0
    reparsed = 0
    async for d in db.module_mail_inbox.find(
        {},
        {"_id": 0, "id": 1, "parsed": 1, "body_excerpt": 1, "from_email": 1, "status": 1, "subject": 1},
    ):
        new_parsed = parse_anfrage(
            d.get("body_excerpt") or "",
            subject=d.get("subject") or "",
            from_email=d.get("from_email") or "",
        )
        # Reply-To-Fallback wie beim Scan
        if not new_parsed.get("email") and d.get("from_email") and "jimdo" not in (d.get("from_email") or "").lower():
            new_parsed["email"] = d.get("from_email")
        new_spam = evaluate_spam(new_parsed, body_excerpt=d.get("body_excerpt") or "", from_email=d.get("from_email") or "")
        update = {"parsed": new_parsed, "spam": new_spam, "content_hash": _content_hash(new_parsed)}
        # Status nur bei vorschlag/spam_verdacht ändern, nicht bei übernommen/ignoriert
        if d.get("status") in ("vorschlag", "spam_verdacht"):
            new_status = "spam_verdacht" if new_spam["is_spam"] else "vorschlag"
            if new_status != d.get("status"):
                update["status"] = new_status
                if new_status == "vorschlag":
                    moved_to_vorschlag += 1
                else:
                    moved_to_spam += 1
        await db.module_mail_inbox.update_one({"id": d["id"]}, {"$set": update})
        reparsed += 1
    return {
        "ok": True,
        "reparsed": reparsed,
        "moved_to_vorschlag": moved_to_vorschlag,
        "moved_to_spam": moved_to_spam,
    }


@router.post("/migrate-anliegen-to-nachricht")
async def migrate_anliegen_to_nachricht(
    dry_run: bool = True,
    user=Depends(get_current_user),
):
    """One-Shot-Migration: Bug-Fix 07.05.2026.

    Vorher hat /accept das Feld als `anliegen` gespeichert, die Kunden-
    Datenmaske erwartet aber `nachricht` (Single Source of Truth).
    Diese Migration kopiert `anliegen → nachricht` ausschließlich dort,
    wo `nachricht` leer/fehlt. Bestehende manuell gepflegte Nachrichten
    werden NICHT überschrieben. Das veraltete `anliegen`-Feld wird danach
    aus dem betroffenen Datensatz entfernt.

    Standardmäßig im **Dry-Run** — nichts wird verändert, es wird nur
    gemeldet, was passieren würde. Mit `?dry_run=false` echt ausführen.
    """
    would_migrate = []
    would_only_unset = []
    cursor = db.module_kunden.find(
        {"anliegen": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "name": 1, "anliegen": 1, "nachricht": 1},
    )
    async for k in cursor:
        existing_nachricht = (k.get("nachricht") or "").strip()
        anliegen = (k.get("anliegen") or "").strip()
        preview = {
            "id": k["id"],
            "name": k.get("name", ""),
            "anliegen_excerpt": anliegen[:80],
            "nachricht_excerpt": existing_nachricht[:80],
        }
        if existing_nachricht:
            would_only_unset.append(preview)
            if not dry_run:
                await db.module_kunden.update_one(
                    {"id": k["id"]}, {"$unset": {"anliegen": ""}}
                )
        else:
            would_migrate.append(preview)
            if not dry_run:
                await db.module_kunden.update_one(
                    {"id": k["id"]},
                    {"$set": {"nachricht": anliegen}, "$unset": {"anliegen": ""}},
                )
    return {
        "ok": True,
        "dry_run": dry_run,
        "migrated_count": len(would_migrate),
        "skipped_already_has_nachricht_count": len(would_only_unset),
        "to_migrate": would_migrate,
        "to_unset_only": would_only_unset,
    }

