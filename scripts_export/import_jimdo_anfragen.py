#!/usr/bin/env python3
"""Import der 19 Jimdo-Anfragen in db.module_mail_inbox.

AUF LIVE AUSZUFÜHREN (durch Ralph). Vorher PFLICHT: DB-Snapshot (Regel 5)!

Sicherheits-Eigenschaften:
- Duplikat-Prüfung je Eintrag über message_id ODER content_hash -> bereits
  vorhandene Einträge werden ÜBERSPRUNGEN (idempotent, mehrfach ausführbar).
- Standard = DRY-RUN (zeigt nur, was passieren würde, schreibt NICHTS).
- Schreiben erst mit --apply UND getippter Bestätigung 'JA'.
- Fasst ausschließlich Collection module_mail_inbox an.

Verwendung:
    # 1) DB-Snapshot zuerst!
    mongodump --uri="$MONGO_URL" --db="$DB_NAME" --collection=module_mail_inbox --out=./snap_vor_import

    # 2) Probelauf (schreibt nichts):
    python import_jimdo_anfragen.py preview_anfragen_JIMDO_NUR_20260611_162328.json

    # 3) Import (fragt nach 'JA'):
    python import_jimdo_anfragen.py preview_anfragen_JIMDO_NUR_20260611_162328.json --apply
"""
import json
import os
import sys

from pymongo import MongoClient

COLLECTION = "module_mail_inbox"


def exists(col, doc) -> bool:
    mid = doc.get("message_id")
    if mid and col.find_one({"message_id": mid}, {"_id": 1}):
        return True
    chash = doc.get("content_hash")
    if chash and col.find_one({"content_hash": chash}, {"_id": 1}):
        return True
    return False


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_jimdo_anfragen.py <jimdo_export.json> [--apply]")
        sys.exit(1)
    path = sys.argv[1]
    apply = "--apply" in sys.argv

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("FEHLER: MONGO_URL / DB_NAME nicht gesetzt. Abbruch.")
        sys.exit(1)

    col = MongoClient(mongo_url)[db_name][COLLECTION]

    with open(path, encoding="utf-8") as f:
        docs = json.load(f)

    neu, vorhanden = [], []
    for d in docs:
        (vorhanden if exists(col, d) else neu).append(d)

    print(f"Datenbank: {db_name} | Collection: {COLLECTION}")
    print(f"Einträge in Datei:        {len(docs)}")
    print(f"Bereits vorhanden (skip): {len(vorhanden)}")
    print(f"NEU zu importieren:       {len(neu)}")
    for d in neu:
        p = d.get("parsed") or {}
        print(f"  + {(p.get('email') or '')[:30]:30} | {(d.get('subject') or '')[:50]}")

    if not apply:
        print("\nDRY-RUN: Es wurde NICHTS geschrieben. Mit '--apply' erneut starten.")
        return
    if not neu:
        print("\nNichts zu importieren.")
        return

    answer = input(f"\n{len(neu)} neue Einträge importieren? Tippe 'JA': ").strip()
    if answer != "JA":
        print("Abgebrochen. Es wurde NICHTS geschrieben.")
        return

    # _id entfernen, falls vorhanden (Mongo vergibt neue) – id-Feld bleibt erhalten
    for d in neu:
        d.pop("_id", None)
    res = col.insert_many(neu)
    print(f"\nFERTIG: {len(res.inserted_ids)} Einträge importiert.")


if __name__ == "__main__":
    main()
