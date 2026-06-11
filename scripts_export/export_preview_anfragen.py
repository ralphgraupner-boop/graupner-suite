#!/usr/bin/env python3
"""NUR LESEN: Exportiert Mail-Anfragen der letzten 3 Wochen aus der Preview-DB.

- Schreibt NICHTS in die DB.
- Liest db.module_mail_inbox, filtert received_at/created_at >= heute-21 Tage.
- Schreibt vollständige Dokumente als JSON (gleiche Struktur wie Collection).
- Gibt zusätzlich die Liste der message_id aus (für Live-Abgleich durch Ralph).
"""
import json
import os
from datetime import datetime, timezone, timedelta

from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "graupner_suite")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

cutoff = (datetime.now(timezone.utc) - timedelta(days=21)).isoformat()

# received_at ODER created_at innerhalb der letzten 3 Wochen
query = {"$or": [{"received_at": {"$gte": cutoff}}, {"created_at": {"$gte": cutoff}}]}

docs = list(db.module_mail_inbox.find(query, {"_id": 0}))
docs.sort(key=lambda d: d.get("received_at") or d.get("created_at") or "", reverse=True)

out_dir = "/app/scripts_export"
os.makedirs(out_dir, exist_ok=True)
stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
out_file = os.path.join(out_dir, f"preview_anfragen_3w_{stamp}.json")

with open(out_file, "w", encoding="utf-8") as f:
    json.dump(docs, f, ensure_ascii=False, indent=2, default=str)

# message_id-Liste separat
mids = [d.get("message_id") for d in docs if d.get("message_id")]
ids_file = os.path.join(out_dir, f"preview_message_ids_3w_{stamp}.json")
with open(ids_file, "w", encoding="utf-8") as f:
    json.dump(mids, f, ensure_ascii=False, indent=2)

print(f"Cutoff (>=): {cutoff}")
print(f"Gesamt Einträge (3 Wochen): {len(docs)}")
print(f"Davon mit message_id: {len(mids)}  | ohne message_id: {len(docs) - len(mids)}")
print(f"Export-Datei: {out_file}")
print(f"Message-ID-Liste: {ids_file}")
print("\n--- Status-Verteilung ---")
from collections import Counter
for st, n in Counter(d.get("status") for d in docs).items():
    print(f"  {st}: {n}")
print("\n--- Beispiel-Eintrag (Felder) ---")
if docs:
    print(sorted(docs[0].keys()))
