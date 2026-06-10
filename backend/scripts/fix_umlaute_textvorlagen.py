#!/usr/bin/env python3
"""
Reparatur-Skript: Kaputte Umlaute (Mojibake) in der Collection `module_textvorlagen`.

REGELN (eingebaut):
- Fasst AUSSCHLIESSLICH die Collection `module_textvorlagen` an. Kein anderes Modul.
- Zeigt ZUERST alle betroffenen Einträge alt -> neu (Dry-Run).
- Schreibt NUR nach getippter Bestätigung "JA".
- Liest Verbindung aus Umgebungsvariablen MONGO_URL und DB_NAME (kein Hardcode).

Verwendung:
    # Nur anzeigen (Standard, schreibt NICHTS):
    python fix_umlaute_textvorlagen.py

    # Anzeigen + nach Bestaetigung schreiben:
    python fix_umlaute_textvorlagen.py --apply
"""
import os
import sys

from pymongo import MongoClient

COLLECTION = "module_textvorlagen"

# Bekannte Mojibake-Artefakte (UTF-8-Bytes als Latin-1/CP1252 fehlinterpretiert)
FIXES = {
    "\u00c3\u00a4": "\u00e4",  # Ã¤ -> ä
    "\u00c3\u00b6": "\u00f6",  # Ã¶ -> ö
    "\u00c3\u00bc": "\u00fc",  # Ã¼ -> ü
    "\u00c3\u0084": "\u00c4",  # Ã„ -> Ä
    "\u00c3\u0096": "\u00d6",  # Ã– -> Ö
    "\u00c3\u009c": "\u00dc",  # Ãœ -> Ü
    "\u00c3\u009f": "\u00df",  # ÃŸ -> ß
    "\u00c3\u0178": "\u00df",  # Ã -> ß (Variante)
    "\u00e2\u0082\u00ac": "\u20ac",  # â‚¬ -> €
}


def fix_text(s: str) -> str:
    for bad, good in FIXES.items():
        s = s.replace(bad, good)
    return s


def has_artifact(s: str) -> bool:
    return any(bad in s for bad in FIXES)


def main():
    apply = "--apply" in sys.argv

    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        print("FEHLER: MONGO_URL oder DB_NAME nicht gesetzt. Abbruch.")
        sys.exit(1)

    client = MongoClient(mongo_url)
    col = client[db_name][COLLECTION]

    total_docs = col.count_documents({})
    print(f"Datenbank: {db_name}  |  Collection: {COLLECTION}")
    print(f"Dokumente gesamt: {total_docs}\n")

    # Betroffene Felder sammeln (nur String-Felder, _id/id nie aendern)
    changes = []  # (doc_id_value, field, old, new)
    for doc in col.find({}):
        doc_id = doc.get("id")
        for field, value in doc.items():
            if field in ("_id", "id"):
                continue
            if isinstance(value, str) and has_artifact(value):
                new_value = fix_text(value)
                changes.append((doc.get("_id"), doc_id, field, value, new_value))

    if not changes:
        print("KEINE kaputten Umlaute gefunden. Nichts zu tun.")
        return

    print(f"BETROFFENE FELDER: {len(changes)}")
    print("=" * 100)
    for i, (_id, doc_id, field, old, new) in enumerate(changes, 1):
        print(f"\n[{i}] id={doc_id}  feld='{field}'")
        print(f"    ALT: {old}")
        print(f"    NEU: {new}")
    print("\n" + "=" * 100)

    if not apply:
        print("\nDRY-RUN: Es wurde NICHTS geschrieben.")
        print("Zum Schreiben erneut mit '--apply' starten.")
        return

    answer = input(f"\n{len(changes)} Felder korrigieren? Tippe 'JA' zum Schreiben: ").strip()
    if answer != "JA":
        print("Abgebrochen. Es wurde NICHTS geschrieben.")
        return

    written = 0
    for _id, doc_id, field, old, new in changes:
        col.update_one({"_id": _id}, {"$set": {field: new}})
        written += 1
    print(f"\nFERTIG: {written} Felder in '{COLLECTION}' korrigiert.")


if __name__ == "__main__":
    main()
