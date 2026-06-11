#!/usr/bin/env python3
"""NUR LESEN / NUR DATEI-OUTPUT: Filtert den Preview-Export auf die Einträge,
deren message_id NICHT in der Live-message_id-Liste enthalten ist.

Verwendung:
    python filter_missing_on_live.py <preview_export.json> <live_message_ids.json>

- Schreibt NICHTS in irgendeine DB.
- Ausgabe: <preview_export>_FEHLT_AUF_LIVE.json (gleiche Struktur wie Collection).
- Live-IDs-Datei darf sein: JSON-Array von Strings, ODER mongoexport-JSONL
  (eine Zeile pro Doc mit {"message_id": "..."}).
"""
import json
import sys


def load_live_ids(path: str) -> set:
    ids = set()
    with open(path, encoding="utf-8") as f:
        raw = f.read().strip()
    # Versuch 1: JSON-Array
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            for x in data:
                if isinstance(x, str):
                    ids.add(x)
                elif isinstance(x, dict) and x.get("message_id"):
                    ids.add(x["message_id"])
            return ids
        if isinstance(data, dict) and data.get("message_id"):
            ids.add(data["message_id"])
            return ids
    except json.JSONDecodeError:
        pass
    # Versuch 2: JSONL (mongoexport)
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
            if isinstance(d, dict) and d.get("message_id"):
                ids.add(d["message_id"])
            elif isinstance(d, str):
                ids.add(d)
        except json.JSONDecodeError:
            continue
    return ids


def main():
    if len(sys.argv) != 3:
        print("Usage: python filter_missing_on_live.py <preview_export.json> <live_message_ids.json>")
        sys.exit(1)
    preview_path, live_ids_path = sys.argv[1], sys.argv[2]

    with open(preview_path, encoding="utf-8") as f:
        preview = json.load(f)
    live_ids = load_live_ids(live_ids_path)

    missing = [d for d in preview if d.get("message_id") and d["message_id"] not in live_ids]
    ohne_mid = [d for d in preview if not d.get("message_id")]

    out_path = preview_path.replace(".json", "_FEHLT_AUF_LIVE.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(missing, f, ensure_ascii=False, indent=2, default=str)

    print(f"Preview-Einträge:        {len(preview)}")
    print(f"Live message_id bekannt: {len(live_ids)}")
    print(f"FEHLT auf Live:          {len(missing)}")
    print(f"Ohne message_id (Hinweis, nicht im Abgleich): {len(ohne_mid)}")
    print(f"Ausgabe-Datei: {out_path}")


if __name__ == "__main__":
    main()
