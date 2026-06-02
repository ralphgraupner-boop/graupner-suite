"""Einmalige Daten-Migrationen — manuell pro Umgebung getriggert.

Hier landen Migrationen, die NICHT automatisch beim Start laufen sollen,
sondern explizit von einem Admin angestossen werden (mit Pre-Backup).
Jede Migration unterstuetzt `dry_run=true`, um die Auswirkungen anzuzeigen,
ohne etwas zu aendern.
"""
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from security.admin_check import require_admin
from database import db, logger

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/migrate-projekte-bezug", dependencies=[Depends(require_admin)])
async def migrate_projekte_bezug(dry_run: bool = True, user=Depends(get_current_user)):
    """Migriert Aufgaben + Termine, die einen Kunde aber kein Projekt haben:
    - Pro betroffenem Kunde wird (falls noch nicht vorhanden) ein Sammelprojekt
      'Allgemein / Buero' angelegt.
    - Bestehende Aufgaben/Termine werden diesem Projekt zugewiesen.

    Reminder ohne Kunde bleiben unveraendert.

    `dry_run=true` zeigt nur was passieren wuerde, ohne zu schreiben.
    """
    SAMMEL_TITEL = "Allgemein / Büro"

    # 1) Betroffene Kunden ermitteln
    no_projekt_filter = {
        "kunde_id": {"$exists": True, "$ne": ""},
        "$or": [
            {"projekt_id": {"$exists": False}},
            {"projekt_id": ""},
            {"projekt_id": None},
        ],
    }
    aufgaben_kids = await db.module_aufgaben.distinct("kunde_id", no_projekt_filter)
    termine_kids = await db.module_termine.distinct("kunde_id", no_projekt_filter)
    betroffene_kids = sorted(set(k for k in (aufgaben_kids + termine_kids) if k))

    if not betroffene_kids:
        return {
            "ok": True,
            "dry_run": dry_run,
            "betroffene_kunden": 0,
            "neue_projekte": 0,
            "aufgaben_migriert": 0,
            "termine_migriert": 0,
            "details": [],
            "hinweis": "Keine Aufgaben/Termine mit Kundenbezug ohne Projekt gefunden — nichts zu tun.",
        }

    details = []
    neue_projekte = 0
    aufgaben_total = 0
    termine_total = 0
    now = datetime.now(timezone.utc).isoformat()

    for kid in betroffene_kids:
        # Kunde existiert noch?
        kunde = await db.module_kunden.find_one({"id": kid}, {"_id": 0, "vorname": 1, "nachname": 1, "firma": 1})
        if not kunde:
            details.append({
                "kunde_id": kid,
                "uebersprungen": True,
                "grund": "Kunde existiert nicht (mehr) in module_kunden",
            })
            continue

        # Existiert Sammelprojekt schon?
        sammel = await db.module_projekte.find_one(
            {"kunde_id": kid, "titel": SAMMEL_TITEL},
            {"_id": 0, "id": 1},
        )
        sammel_neu_angelegt = False
        if sammel:
            sammel_id = sammel["id"]
        else:
            sammel_id = str(uuid4())
            if not dry_run:
                await db.module_projekte.insert_one({
                    "id": sammel_id,
                    "kunde_id": kid,
                    "titel": SAMMEL_TITEL,
                    "beschreibung": "Sammelprojekt fuer Aufgaben/Termine ohne spezifischen Projektbezug. Angelegt durch Migration am " + now,
                    "kategorie": "",
                    "status": "Aktiv",
                    "created_at": now,
                    "updated_at": now,
                    "created_by": (user or {}).get("username", "migration"),
                    "sort_order": 9999,
                })
            sammel_neu_angelegt = True
            neue_projekte += 1

        # Aufgaben dieses Kunden migrieren
        aufgaben_count = await db.module_aufgaben.count_documents({**no_projekt_filter, "kunde_id": kid})
        if not dry_run and aufgaben_count > 0:
            await db.module_aufgaben.update_many(
                {**no_projekt_filter, "kunde_id": kid},
                {"$set": {"projekt_id": sammel_id, "updated_at": now}},
            )
        aufgaben_total += aufgaben_count

        # Termine dieses Kunden migrieren
        termine_count = await db.module_termine.count_documents({**no_projekt_filter, "kunde_id": kid})
        if not dry_run and termine_count > 0:
            await db.module_termine.update_many(
                {**no_projekt_filter, "kunde_id": kid},
                {"$set": {"projekt_id": sammel_id, "updated_at": now}},
            )
        termine_total += termine_count

        kunde_name = (
            f"{kunde.get('vorname','')} {kunde.get('nachname','')}".strip()
            or kunde.get("firma", "")
            or kid[:8]
        )
        details.append({
            "kunde_id": kid,
            "kunde_name": kunde_name,
            "sammel_projekt_id": sammel_id,
            "sammel_neu_angelegt": sammel_neu_angelegt,
            "aufgaben_zugewiesen": aufgaben_count,
            "termine_zugewiesen": termine_count,
        })

    if not dry_run:
        logger.info(
            f"migrate_projekte_bezug: {neue_projekte} neue Sammelprojekte, "
            f"{aufgaben_total} Aufgaben + {termine_total} Termine migriert "
            f"(von {(user or {}).get('username','?')})"
        )

    return {
        "ok": True,
        "dry_run": dry_run,
        "betroffene_kunden": len(betroffene_kids),
        "neue_projekte": neue_projekte,
        "aufgaben_migriert": aufgaben_total,
        "termine_migriert": termine_total,
        "details": details,
        "hinweis": (
            "DRY-RUN: nichts wurde geaendert. Nochmal mit dry_run=false ausfuehren."
            if dry_run else
            "Migration abgeschlossen. Pre-Backup vor diesem Lauf sollte vorhanden sein."
        ),
    }
