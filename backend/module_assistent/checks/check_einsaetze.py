"""Check: Einsätze ohne Bericht oder Rechnung."""
from datetime import datetime, timezone, timedelta
from database import db
from ..routes import _erstelle_hinweis


async def check_einsaetze() -> list:
    hinweise = []
    now = datetime.now(timezone.utc)
    vor_1_tag = (now - timedelta(days=1)).isoformat()
    vor_7_tage = (now - timedelta(days=7)).isoformat()

    async for einsatz in db.einsaetze.find(
        {"status": "abgeschlossen", "created_at": {"$lt": vor_1_tag}},
        {"_id": 0},
    ):
        # Kundendaten live holen (Datenmasken-Prinzip)
        kunde_name = einsatz.get("kunde_name", "Kunde")
        if einsatz.get("kunde_id"):
            k = await db.module_kunden.find_one(
                {"id": einsatz["kunde_id"]},
                {"_id": 0, "name": 1, "vorname": 1, "nachname": 1},
            )
            if k:
                kunde_name = k.get("name") or f"{k.get('vorname','')} {k.get('nachname','')}".strip() or kunde_name

        hat_bericht = bool(einsatz.get("bericht") or einsatz.get("notizen") or einsatz.get("bemerkungen"))
        hat_rechnung = bool(einsatz.get("rechnung_id"))

        if not hat_bericht:
            hinweise.append(_erstelle_hinweis(
                typ="einsatz_kein_bericht",
                prioritaet="hinweis",
                titel=f"Einsatz bei {kunde_name} – Bericht fehlt",
                nachricht=f"Abgeschlossener Einsatz bei {kunde_name} hat noch keinen Bericht.",
                referenz_id=einsatz.get("id", "") + "_bericht",
                modul="module_einsaetze",
                kunde_name=kunde_name,
                aktionen=[
                    {"label": "Einsatz öffnen", "link": "/einsaetze"},
                    {"label": "Ignorieren", "aktion": "ignorieren"},
                ],
                gueltig_tage=7,
            ))

        if not hat_rechnung and einsatz.get("created_at", "") < vor_7_tage:
            hinweise.append(_erstelle_hinweis(
                typ="einsatz_keine_rechnung",
                prioritaet="hoch",
                titel=f"Einsatz bei {kunde_name} – Rechnung fehlt seit 7 Tagen",
                nachricht=f"Einsatz bei {kunde_name} wurde vor über 7 Tagen abgeschlossen – noch keine Rechnung.",
                referenz_id=einsatz.get("id", "") + "_rechnung",
                modul="module_einsaetze",
                kunde_name=kunde_name,
                aktionen=[
                    {"label": "Rechnung erstellen", "link": "/rechnungen-v2"},
                    {"label": "Ignorieren", "aktion": "ignorieren"},
                ],
                gueltig_tage=14,
            ))
    return hinweise
