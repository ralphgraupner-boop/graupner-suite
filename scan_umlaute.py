import os
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["graupner_suite"]
col = db["module_textvorlagen"]

# Bekannte Mojibake-Artefakte (UTF-8 als Latin-1 fehlinterpretiert)
FIXES = {
    "\u00c3\u00a4": "\u00e4",  # ä
    "\u00c3\u00b6": "\u00f6",  # ö
    "\u00c3\u00bc": "\u00fc",  # ü
    "\u00c3\u0084": "\u00c4",  # Ä
    "\u00c3\u0096": "\u00d6",  # Ö
    "\u00c3\u009c": "\u00dc",  # Ü
    "\u00c3\u009f": "\u00df",  # ß
    "\u00c3\u0178": "\u00df",  # ß variant
}

def fix_text(s):
    for bad, good in FIXES.items():
        s = s.replace(bad, good)
    return s

def has_artifact(s):
    return any(bad in s for bad in FIXES) or "\ufffd" in s or "?" in s and False

total = 0
affected = []
for doc in col.find({}):
    for k, v in doc.items():
        if isinstance(v, str) and any(bad in v for bad in FIXES):
            fixed = fix_text(v)
            affected.append((str(doc.get("_id")), doc.get("name") or doc.get("titel") or doc.get("typ") or "", k, v, fixed))
            total += 1

print(f"GESAMT Dokumente: {col.count_documents({})}")
print(f"BETROFFENE Felder mit kaputten Umlauten: {total}\n")
print("="*100)
for i, (oid, label, field, old, new) in enumerate(affected, 1):
    print(f"\n[{i}] _id={oid}  | label='{label}'  | feld='{field}'")
    print(f"    ALT: {old[:200]}")
    print(f"    NEU: {new[:200]}")
