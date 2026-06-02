"""Kunden-Diff: Vergleicht Preview-Kunden mit einem Live-Backup-Snapshot.

WICHTIG — NUR LESEND:
- Liest aus der lokalen Preview-MongoDB (db.module_kunden).
- Liest aus einem hochgeladenen Live-Backup-ZIP (z.B. aus /app/backups/ oder
  einem ZIP, das Ralph vom Live-System geholt hat).
- Schreibt NICHTS in eine DB. Schreibt NICHTS an Live.
- Liefert eine JSON-Datei mit:
    only_in_preview: Kunden, die nur auf Preview existieren (Kandidaten fuer Export)
    in_beiden:       Kunden, die in beiden Systemen existieren (id-Match)
    only_in_live:    Kunden, die nur in Live existieren (zur Info)

Aufruf:
    python /app/backend/scripts/kunden_diff_preview_live.py /pfad/zu/live_backup.zip
    → Ergebnis-Datei: /app/backend/scripts/kunden_diff_<timestamp>.json

Identitaets-Schluessel: 'id' (UUID). Falls auf Live noch ohne UUID, fallback auf
(email + nachname + vorname).
"""
from __future__ import annotations
import asyncio
import json
import sys
import os
import zipfile
import argparse
from datetime import datetime, timezone
from typing import Set

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db, logger  # noqa: E402


def _identitaet(k: dict) -> str:
    """Eindeutiger Schluessel zum Vergleich (id bevorzugt)."""
    if k.get("id"):
        return f"id::{k['id']}"
    email = (k.get("email") or "").strip().lower()
    vorname = (k.get("vorname") or "").strip().lower()
    nachname = (k.get("nachname") or "").strip().lower()
    return f"compound::{email}|{nachname}|{vorname}"


def lade_live_kunden_aus_zip(zip_pfad: str) -> list:
    """Liest module_kunden aus einem Backup-ZIP.

    Backups enthalten i.d.R. pro Collection eine .json oder .bson Datei.
    Wir suchen nach 'module_kunden.json' im ZIP.
    """
    if not os.path.exists(zip_pfad):
        raise FileNotFoundError(f"Live-Backup-ZIP nicht gefunden: {zip_pfad}")

    with zipfile.ZipFile(zip_pfad, "r") as zf:
        # Mehrere Pfad-Varianten probieren
        kandidaten = [
            "module_kunden.json",
            "collections/module_kunden.json",
            "data/module_kunden.json",
        ]
        treffer = None
        for kand in kandidaten:
            if kand in zf.namelist():
                treffer = kand
                break
        if not treffer:
            # Fallback: irgendwas mit module_kunden im Namen
            for name in zf.namelist():
                if "module_kunden" in name and name.endswith(".json"):
                    treffer = name
                    break
        if not treffer:
            raise ValueError(
                "Kein 'module_kunden.json' im ZIP gefunden. "
                f"Verfuegbar: {zf.namelist()[:20]}..."
            )

        with zf.open(treffer) as fh:
            inhalt = json.loads(fh.read().decode("utf-8"))
            if isinstance(inhalt, dict) and "data" in inhalt:
                inhalt = inhalt["data"]
            if not isinstance(inhalt, list):
                raise ValueError(f"'{treffer}' liefert kein Array — bekam {type(inhalt).__name__}")
            return inhalt


async def lade_preview_kunden() -> list:
    """Alle Preview-Kunden aus db.module_kunden (read-only)."""
    cursor = db.module_kunden.find({}, {"_id": 0})
    return await cursor.to_list(10000)


def diff(preview: list, live: list) -> dict:
    keys_preview: Set[str] = set()
    keys_live: Set[str] = set()
    by_key_preview = {}
    by_key_live = {}
    for k in preview:
        key = _identitaet(k)
        keys_preview.add(key)
        by_key_preview[key] = k
    for k in live:
        key = _identitaet(k)
        keys_live.add(key)
        by_key_live[key] = k

    only_preview_keys = keys_preview - keys_live
    only_live_keys = keys_live - keys_preview
    beide_keys = keys_preview & keys_live

    return {
        "only_in_preview": [by_key_preview[k] for k in sorted(only_preview_keys)],
        "only_in_live": [by_key_live[k] for k in sorted(only_live_keys)],
        "in_beiden": sorted(list(beide_keys)),
        "stats": {
            "preview_gesamt": len(preview),
            "live_gesamt": len(live),
            "nur_preview": len(only_preview_keys),
            "nur_live": len(only_live_keys),
            "in_beiden": len(beide_keys),
        },
    }


async def main_async(zip_pfad: str, out_dir: str = "/app/backend/scripts") -> str:
    logger.info("Lade Preview-Kunden aus DB ...")
    preview = await lade_preview_kunden()
    logger.info(f"Preview: {len(preview)} Kunden")

    logger.info(f"Lade Live-Kunden aus {zip_pfad} ...")
    live = lade_live_kunden_aus_zip(zip_pfad)
    logger.info(f"Live: {len(live)} Kunden")

    result = diff(preview, live)
    result["meta"] = {
        "preview_quelle": "db.module_kunden (Preview-Container)",
        "live_quelle": zip_pfad,
        "erstellt_am": datetime.now(timezone.utc).isoformat(),
        "identitaets_regel": "id bevorzugt, sonst email|nachname|vorname",
        "schreibvorgaenge": "KEINE — read-only Diff",
    }

    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_pfad = os.path.join(out_dir, f"kunden_diff_{ts}.json")
    with open(out_pfad, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2, default=str)

    print("="*60)
    print(f"FERTIG. Ergebnis: {out_pfad}")
    print("="*60)
    print(json.dumps(result["stats"], indent=2))
    print("="*60)
    if result["only_in_preview"]:
        print(f"\n→ {len(result['only_in_preview'])} Kunden NUR auf Preview (Beispiel-IDs):")
        for k in result["only_in_preview"][:5]:
            name = (
                f"{k.get('vorname','')} {k.get('nachname','')}".strip()
                or k.get("name", "")
                or k.get("firma", "")
                or "?"
            )
            print(f"   {k.get('id','(keine id)'):<40}  {name}")
    print("\nKEIN automatischer Export. Naechster Schritt nur mit explizitem 'Ja' von Ralph.")
    return out_pfad


def main():
    ap = argparse.ArgumentParser(description="Read-only Diff Preview ↔ Live Kunden")
    ap.add_argument("live_zip", help="Pfad zum Live-Backup-ZIP")
    ap.add_argument("--out-dir", default="/app/backend/scripts", help="Zielverzeichnis fuer JSON")
    args = ap.parse_args()
    asyncio.run(main_async(args.live_zip, args.out_dir))


if __name__ == "__main__":
    main()
