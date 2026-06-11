#!/usr/bin/env python3
"""Abgleich der Jimdo-Anfragen gegen vorhandene Kunden.

Erzeugt 3 Listen:
  1) NEU       -> E-Mail (und Name) nicht als Kunde vorhanden  => importieren
  2) KUNDE     -> E-Mail bereits als Kunde vorhanden            => nicht importieren
  3) UNSICHER  -> kein E-Mail-Treffer, aber Name passt zu Kunde => Ralph entscheidet

Kundenquelle:
  --source preview : liest db.module_kunden + db.customers aus DER DB in MONGO_URL/DB_NAME
  --source file <kunden.json> : nutzt eine bereitgestellte Kundenliste (für LIVE-Abgleich)
        Datei = JSON-Array von Objekten mit Feldern email / vorname / nachname / firma / name
        ODER mongoexport-JSONL solcher Objekte.

Verwendung:
    python compare_with_customers.py <jimdo_export.json> --source preview
    python compare_with_customers.py <jimdo_export.json> --source file live_customers.json
"""
import json
import os
import sys


def norm(s: str) -> str:
    return (s or "").strip().lower()


def name_key(vor: str, nach: str, firma: str = "", name: str = "") -> str:
    full = " ".join([p for p in [vor, nach] if p]).strip()
    return norm(full or name or firma)


def build_customer_sets_from_docs(docs):
    emails, names = set(), set()
    for c in docs:
        for ef in ("email", "e_mail", "mail"):
            if c.get(ef):
                emails.add(norm(c[ef]))
        nk = name_key(c.get("vorname", ""), c.get("nachname", ""), c.get("firma", ""), c.get("name", ""))
        if nk:
            names.add(nk)
    return emails, {n for n in names if n}


def load_customers(source, file_path):
    if source == "preview":
        from pymongo import MongoClient
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            print("FEHLER: MONGO_URL / DB_NAME nicht gesetzt.")
            sys.exit(1)
        db = MongoClient(mongo_url)[db_name]
        docs = list(db.module_kunden.find({}, {"_id": 0})) + list(db.customers.find({}, {"_id": 0}))
        return docs, "PREVIEW-DB (module_kunden + customers)"
    # file
    with open(file_path, encoding="utf-8") as f:
        raw = f.read().strip()
    try:
        data = json.loads(raw)
        docs = data if isinstance(data, list) else [data]
    except json.JSONDecodeError:
        docs = [json.loads(l) for l in raw.splitlines() if l.strip()]
    return docs, f"DATEI {file_path}"


def main():
    if len(sys.argv) < 2:
        print("Usage: python compare_with_customers.py <jimdo_export.json> --source preview|file [kunden.json]")
        sys.exit(1)
    jimdo_path = sys.argv[1]
    source = "preview"
    file_path = None
    if "--source" in sys.argv:
        i = sys.argv.index("--source")
        source = sys.argv[i + 1]
        if source == "file":
            file_path = sys.argv[i + 2]

    with open(jimdo_path, encoding="utf-8") as f:
        jimdo = json.load(f)

    cust_docs, quelle = load_customers(source, file_path)
    cust_emails, cust_names = build_customer_sets_from_docs(cust_docs)

    neu, kunde, unsicher = [], [], []
    for d in jimdo:
        p = d.get("parsed") or {}
        email = norm(p.get("email"))
        nk = name_key(p.get("vorname", ""), p.get("nachname", ""))
        label = f"{p.get('vorname','')} {p.get('nachname','')}".strip() or "(ohne Name)"
        if email and email in cust_emails:
            kunde.append((label, email))
        elif nk and nk in cust_names:
            unsicher.append((label, email))
        else:
            neu.append((label, email))

    print(f"Kundenquelle: {quelle}")
    print(f"Kunden-E-Mails: {len(cust_emails)} | Kunden-Namen: {len(cust_names)}")
    print("=" * 70)
    print(f"\n[1] NEU (importieren): {len(neu)}")
    for l, e in neu:
        print(f"    + {l[:28]:28} | {e}")
    print(f"\n[2] BEREITS KUNDE (nicht importieren): {len(kunde)}")
    for l, e in kunde:
        print(f"    = {l[:28]:28} | {e}")
    print(f"\n[3] UNSICHER (Ralph entscheidet – Name passt, E-Mail nicht): {len(unsicher)}")
    for l, e in unsicher:
        print(f"    ? {l[:28]:28} | {e}")


if __name__ == "__main__":
    main()
