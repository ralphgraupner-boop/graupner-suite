"""Check: Angebote ohne Antwort."""
from datetime import datetime, timezone, timedelta
from database import db
from ..routes import _erstelle_hinweis


async def check_angebote() -> list:
    hinweise = []
    now = datetime.now(timezone.utc)
    grenze_7 = (now - timedelta(days=7)).isoformat()
    grenze_14 = (now - timedelta(days=14)).isoformat()
    grenze_21 = (now - timedelta(days=21)).isoformat()

    async for angebot in db.quotes.find(
        {"status": {"$in": ["Entwurf", "Gesendet"]}, "created_at": {"$lt": grenze_7}},
        {"_id": 0},
    ):
        try:
            erstellt = datetime.fromisoformat(angebot.get("created_at", ""))
            alter = (now - erstellt).days
        except Exception:
            continue

        # Kundendaten live holen (Datenmasken-Prinzip)
        kunde_name = angebot.get("customer_name", "Kunde")
        if angebot.get("customer_id"):
            k = await db.module_kunden.find_one(
                {"id": angebot["customer_id"]},
                {"_id": 0, "name": 1, "vorname": 1, "nachname": 1},
            )
            if k:
                kunde_name = k.get("name") or f"{k.get('vorname','')} {k.get('nachname','')}".strip() or kunde_name

        if angebot.get("created_at", "") < grenze_21:
            typ, prio, titel = "angebot_21_tage", "info", f"Angebot vermutlich verloren ({alter} Tage)"
            nachricht = f"Angebot für {kunde_name} ist seit {alter} Tagen offen – archivieren?"
        elif angebot.get("created_at", "") < grenze_14:
            typ, prio, titel = "angebot_14_tage", "hoch", f"Angebot wartet seit {alter} Tagen"
            nachricht = f"Angebot für {kunde_name} läuft bald ab – noch keine Rückmeldung."
        else:
            typ, prio, titel = "angebot_7_tage", "hinweis", f"Angebot wartet seit {alter} Tagen"
            nachricht = f"Angebot für {kunde_name} wurde noch nicht bestätigt."

        hinweise.append(_erstelle_hinweis(
            typ=typ, prioritaet=prio, titel=titel, nachricht=nachricht,
            referenz_id=angebot.get("id", ""),
            modul="module_angebote",
            kunde_name=kunde_name,
            aktionen=[
                {"label": "Angebot öffnen", "link": "/module/dokumente"},
                {"label": "Ignorieren", "aktion": "ignorieren"},
            ],
        ))
    return hinweise
