"""Check: Mitarbeiter-Muster (nur für Ralph/Admin sichtbar)."""
from datetime import datetime, timezone, timedelta
from database import db
from ..routes import _erstelle_hinweis


async def check_mitarbeiter() -> list:
    hinweise = []
    now = datetime.now(timezone.utc)
    morgen = (now + timedelta(days=1))
    morgen_str = morgen.date().isoformat()

    # Früheinsatz-Check: Einsatz vor 08:00 Uhr morgen früh
    async for termin in db.module_termine.find(
        {"datum": {"$regex": f"^{morgen_str}T0[0-7]"}},
        {"_id": 0},
    ):
        monteur = termin.get("monteur", "")
        if not monteur:
            continue
        uhrzeit = termin.get("datum", "")[11:16]

        hinweise.append(_erstelle_hinweis(
            typ="mitarbeiter_frueheinsatz",
            prioritaet="info",
            titel=f"Früheinsatz morgen: {monteur} um {uhrzeit}",
            nachricht=f"{monteur} hat morgen einen Früheinsatz um {uhrzeit} Uhr. Erinnerung nötig?",
            referenz_id=termin.get("id", "") + "_frueh",
            modul="module_termine",
            aktionen=[
                {"label": "Termin ansehen", "link": "/module/termine"},
                {"label": "Ignorieren", "aktion": "ignorieren"},
            ],
            gueltig_tage=1,
        ))

    # Fehlende Berichte: 3 abgeschlossene Einsätze in Folge ohne Bericht
    pipeline = [
        {"$match": {"status": "abgeschlossen", "bericht": {"$exists": False}}},
        {"$group": {"_id": "$monteur_name", "anzahl": {"$sum": 1}}},
        {"$match": {"anzahl": {"$gte": 3}, "_id": {"$nin": [None, ""]}}},
    ]
    async for row in db.einsaetze.aggregate(pipeline):
        name = row["_id"]
        anzahl = row["anzahl"]
        hinweise.append(_erstelle_hinweis(
            typ="mitarbeiter_kein_bericht",
            prioritaet="hinweis",
            titel=f"{name}: {anzahl} Einsätze ohne Bericht",
            nachricht=f"{name} hat {anzahl} abgeschlossene Einsätze ohne dokumentierten Bericht.",
            referenz_id=f"bericht_{name}",
            modul="module_einsaetze",
            aktionen=[
                {"label": "Einsätze prüfen", "link": "/einsaetze"},
                {"label": "Ignorieren", "aktion": "ignorieren"},
            ],
            gueltig_tage=7,
        ))
    return hinweise
