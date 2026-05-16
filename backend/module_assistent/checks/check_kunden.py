"""Check: Stammkunden ohne Aktivität."""
from datetime import datetime, timezone, timedelta
from database import db
from ..routes import _erstelle_hinweis


async def check_kunden() -> list:
    hinweise = []
    now = datetime.now(timezone.utc)
    vor_6_monaten = (now - timedelta(days=180)).isoformat()

    # Stammkunden (3+ Projekte), seit 6 Monaten kein neues Projekt
    pipeline = [
        {"$group": {"_id": "$kunde_id", "anzahl": {"$sum": 1}, "letztes": {"$max": "$created_at"}}},
        {"$match": {"anzahl": {"$gte": 3}, "letztes": {"$lt": vor_6_monaten}}},
    ]
    async for row in db.module_projekte.aggregate(pipeline):
        kunde_id = row["_id"]
        if not kunde_id:
            continue
        k = await db.module_kunden.find_one(
            {"id": kunde_id},
            {"_id": 0, "name": 1, "vorname": 1, "nachname": 1},
        )
        if not k:
            continue
        kunde_name = k.get("name") or f"{k.get('vorname','')} {k.get('nachname','')}".strip() or "Kunde"

        try:
            tage = (now - datetime.fromisoformat(row["letztes"])).days
        except Exception:
            tage = 180

        hinweise.append(_erstelle_hinweis(
            typ="stammkunde_inaktiv",
            prioritaet="info",
            titel=f"Stammkunde {kunde_name} seit {tage} Tagen inaktiv",
            nachricht=f"{kunde_name} hat {row['anzahl']} Projekte, war aber seit {tage} Tagen nicht mehr aktiv.",
            referenz_id=kunde_id,
            modul="module_kunden",
            kunde_id=kunde_id,
            kunde_name=kunde_name,
            aktionen=[
                {"label": "Kunde öffnen", "link": f"/kunden?edit={kunde_id}"},
                {"label": "Ignorieren", "aktion": "ignorieren"},
            ],
            gueltig_tage=30,
        ))
    return hinweise
