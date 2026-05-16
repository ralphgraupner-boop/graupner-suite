"""Check: Termine ohne GO und Monteur-Überlastung."""
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from database import db
from ..routes import _erstelle_hinweis


async def check_termine() -> list:
    hinweise = []
    now = datetime.now(timezone.utc)
    in_24h = (now + timedelta(hours=24)).isoformat()
    in_48h = (now + timedelta(hours=48)).isoformat()

    # Termine ohne GO in den nächsten 48h
    async for termin in db.module_termine.find(
        {"status": "wartet_auf_go", "datum": {"$lte": in_48h, "$gte": now.isoformat()}},
        {"_id": 0},
    ):
        ist_heute = termin.get("datum", "") <= in_24h
        prio = "kritisch" if ist_heute else "hoch"
        wann = "HEUTE" if ist_heute else "morgen"
        kunde_name = termin.get("kunde_name", "Kunde")

        hinweise.append(_erstelle_hinweis(
            typ="termin_kein_go",
            prioritaet=prio,
            titel=f"Termin {wann} – kein GO",
            nachricht=f"Termin bei {kunde_name} {wann} – noch kein GO gegeben.",
            referenz_id=termin.get("id", ""),
            modul="module_termine",
            kunde_name=kunde_name,
            aktionen=[
                {"label": "Termin öffnen", "link": "/module/termine"},
                {"label": "Ignorieren", "aktion": "ignorieren"},
            ],
            gueltig_tage=2,
        ))

    # Monteur-Überlastung: 4+ Termine am selben Tag
    naechste_14_tage = (now + timedelta(days=14)).isoformat()
    tage_monteur: dict = defaultdict(list)
    async for termin in db.module_termine.find(
        {"datum": {"$gte": now.isoformat(), "$lte": naechste_14_tage}},
        {"_id": 0, "datum": 1, "monteur": 1, "id": 1},
    ):
        tag = termin.get("datum", "")[:10]
        monteur = termin.get("monteur", "")
        if monteur:
            tage_monteur[f"{tag}|{monteur}"].append(termin.get("id", ""))

    for key, ids in tage_monteur.items():
        if len(ids) >= 4:
            tag, monteur = key.split("|")
            hinweise.append(_erstelle_hinweis(
                typ="monteur_ueberlastung",
                prioritaet="hinweis",
                titel=f"{monteur} hat {len(ids)} Termine am {tag}",
                nachricht=f"{monteur} hat am {tag} insgesamt {len(ids)} Termine – ist das realistisch?",
                referenz_id=f"{tag}_{monteur}",
                modul="module_termine",
                aktionen=[
                    {"label": "Termine prüfen", "link": "/module/termine"},
                    {"label": "Ignorieren", "aktion": "ignorieren"},
                ],
            ))
    return hinweise
