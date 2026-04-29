"""
Sammelt alle relationalen Daten eines Kunden.

Reihenfolge der Auflösung:
1. Kunde (customers + module_kunden Variante)
2. Projekte (module_projekte where kunde_id)
3. Aufgaben (module_aufgaben where kunde_id OR projekt_id in projekt_ids)
4. Termine (module_termine where kunde_id OR projekt_id in projekt_ids)
5. Einsätze (einsaetze where kunde_id)
6. Quotes (quotes where customer_id)
7. Rechnungen (rechnungen_v2 where customer_id)
8. Portale (portals, portals_klon, portal2/3/4_accounts where customer_id)
9. Portal-Uploads (portal_files, portal3_uploads, portal4_uploads, portal_klon_files where portal_id)
10. Portal-Aktivität (portal2/4_messages, portal2/4_activity, portal_v2_backups)
11. Monteur-App (todos/fotos/notizen via einsatz_id)
12. Dateien aus Object-Storage (customer.photos[].url, projekt.bilder, alle storage_path)
"""
from typing import Dict, List, Tuple
from database import db


PORTAL_ACCOUNT_COLS = [
    ("portals", "portal"),
    ("portals_klon", "portal_klon"),
    ("portal2_accounts", "portal_v2"),
    ("portal3_accounts", "portal_v3"),
    ("portal4_accounts", "portal_v4"),
]

PORTAL_UPLOAD_COLS = [
    ("portal_files", "portal_id", "storage_path"),
    ("portal_klon_files", "portal_id", "storage_path"),
    ("portal2_uploads", "account_id", "storage_path"),
    ("portal3_uploads", "portal_id", "storage_path"),
    ("portal4_uploads", "account_id", "storage_path"),
]

PORTAL_ACTIVITY_COLS = [
    ("portal2_messages", "account_id"),
    ("portal2_activity", "account_id"),
    ("portal4_messages", "account_id"),
    ("portal4_activity", "account_id"),
    ("portal_v2_backups", "account_id"),
]

MONTEUR_COLS = [
    ("monteur_app_todos", "einsatz_id", None),
    ("monteur_app_fotos", "einsatz_id", "storage_path"),
    ("monteur_app_notizen", "einsatz_id", None),
]


def _strip(doc: dict) -> dict:
    """ObjectId raus."""
    if not doc:
        return doc
    d = dict(doc)
    d.pop("_id", None)
    return d


async def collect_kunde(kunde_id: str) -> Tuple[Dict, List[Tuple[str, str]]]:
    """
    Sammelt alle Daten zu einem Kunden.
    Gibt (data_dict, file_refs) zurück.
    file_refs = Liste von (storage_path, label_im_zip)
    """
    data: Dict = {}
    file_refs: List[Tuple[str, str]] = []

    # 1. Kunde (module_kunden ist die Hauptquelle, customers nur Legacy)
    kunde = _strip(await db.module_kunden.find_one({"id": kunde_id}))
    if not kunde:
        kunde = _strip(await db.customers.find_one({"id": kunde_id}))
    data["kunde"] = kunde or {}

    # Kunde-Foto-Refs
    if kunde:
        for ph in (kunde.get("photos") or []):
            if isinstance(ph, dict) and ph.get("url"):
                file_refs.append((ph["url"], f"files/kunde/{ph.get('filename') or ph['url'].rsplit('/',1)[-1]}"))

    # zusätzlich legacy customers eintrag, falls vorhanden
    legacy = _strip(await db.customers.find_one({"id": kunde_id}))
    if legacy and legacy != kunde:
        data["customers_legacy"] = legacy

    # 2. Projekte
    projekte = [_strip(p) async for p in db.module_projekte.find({"kunde_id": kunde_id})]
    data["projekte"] = projekte
    projekt_ids = [p["id"] for p in projekte if p.get("id")]

    # Projekt-Bilder
    for p in projekte:
        for b in (p.get("bilder") or []):
            url = b.get("url") if isinstance(b, dict) else b
            if url and isinstance(url, str):
                fn = (b.get("filename") if isinstance(b, dict) else None) or url.rsplit("/", 1)[-1]
                file_refs.append((url, f"files/projekte/{p['id']}/{fn}"))

    # 3. Aufgaben
    aufgabe_filter = {"$or": [{"kunde_id": kunde_id}]}
    if projekt_ids:
        aufgabe_filter["$or"].append({"projekt_id": {"$in": projekt_ids}})
    data["aufgaben"] = [_strip(x) async for x in db.module_aufgaben.find(aufgabe_filter)]

    # 4. Termine
    termin_filter = {"$or": [{"kunde_id": kunde_id}]}
    if projekt_ids:
        termin_filter["$or"].append({"projekt_id": {"$in": projekt_ids}})
    data["termine"] = [_strip(x) async for x in db.module_termine.find(termin_filter)]

    # 5. Einsätze
    einsaetze = [_strip(x) async for x in db.einsaetze.find({"kunde_id": kunde_id})]
    data["einsaetze"] = einsaetze
    einsatz_ids = [e["id"] for e in einsaetze if e.get("id")]

    # 6. Quotes
    data["quotes"] = [_strip(x) async for x in db.quotes.find({"customer_id": kunde_id})]

    # 7. Rechnungen
    data["rechnungen"] = [_strip(x) async for x in db.rechnungen_v2.find({"customer_id": kunde_id})]

    # 8. Portale
    portal_acc: Dict[str, list] = {}
    portal_ids_all: List[str] = []
    for col, label in PORTAL_ACCOUNT_COLS:
        accs = [_strip(x) async for x in db[col].find({"customer_id": kunde_id})]
        portal_acc[label] = accs
        portal_ids_all.extend([a["id"] for a in accs if a.get("id")])
    data["portale"] = portal_acc

    # 9. Portal-Uploads
    portal_uploads: Dict[str, list] = {}
    if portal_ids_all:
        for col, fk, file_field in PORTAL_UPLOAD_COLS:
            ups = [_strip(x) async for x in db[col].find({fk: {"$in": portal_ids_all}})]
            portal_uploads[col] = ups
            if file_field:
                for u in ups:
                    sp = u.get(file_field)
                    if sp:
                        fn = u.get("original_filename") or sp.rsplit("/", 1)[-1]
                        file_refs.append((sp, f"files/portal/{u.get('id', 'x')}_{fn}"))
    data["portal_uploads"] = portal_uploads

    # 10. Portal-Aktivität
    portal_activity: Dict[str, list] = {}
    if portal_ids_all:
        for col, fk in PORTAL_ACTIVITY_COLS:
            portal_activity[col] = [_strip(x) async for x in db[col].find({fk: {"$in": portal_ids_all}})]
    data["portal_activity"] = portal_activity

    # 11. Monteur-App
    monteur: Dict[str, list] = {}
    if einsatz_ids:
        for col, fk, file_field in MONTEUR_COLS:
            items = [_strip(x) async for x in db[col].find({fk: {"$in": einsatz_ids}})]
            monteur[col] = items
            if file_field:
                for m in items:
                    sp = m.get(file_field)
                    if sp:
                        fn = sp.rsplit("/", 1)[-1]
                        file_refs.append((sp, f"files/monteur/{m.get('id','x')}_{fn}"))
    data["monteur_app"] = monteur

    return data, file_refs


def count_summary(data: dict) -> dict:
    """Übersicht für Preview-Dialog."""
    return {
        "kunde": 1 if data.get("kunde") else 0,
        "projekte": len(data.get("projekte") or []),
        "aufgaben": len(data.get("aufgaben") or []),
        "termine": len(data.get("termine") or []),
        "einsaetze": len(data.get("einsaetze") or []),
        "quotes": len(data.get("quotes") or []),
        "rechnungen": len(data.get("rechnungen") or []),
        "portale": sum(len(v) for v in (data.get("portale") or {}).values()),
        "portal_uploads": sum(len(v) for v in (data.get("portal_uploads") or {}).values()),
        "portal_activity": sum(len(v) for v in (data.get("portal_activity") or {}).values()),
        "monteur_eintraege": sum(len(v) for v in (data.get("monteur_app") or {}).values()),
    }
