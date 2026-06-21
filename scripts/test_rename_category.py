"""Isolierter Test der sicheren Kategorie-Umbenennung (Preview).
Legt Testdaten an, ruft die echten Endpoints, prueft Migration + Snapshot,
raeumt anschliessend wieder auf."""
import asyncio, os, uuid, json, urllib.request
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient

API = open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0].strip()


def http(method, path, token=None, body=None):
    url = API + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0 (test-rename-category)")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    # Reste evtl. fehlgeschlagener Vorlaeufe entfernen
    await db.module_projekte.delete_many({"name": "ZZ Testprojekt"})
    await db.module_textvorlagen.delete_many({"title": {"$regex": "^ZZTEST_"}})
    ts = datetime.now(timezone.utc).strftime("%H%M%S")
    alt = f"ZZTEST_ALT_{ts}"
    neu = f"ZZTEST_NEU_{ts}"
    tv_id = str(uuid.uuid4())
    pj_id = str(uuid.uuid4())

    # 1) Testdaten anlegen
    await db.module_textvorlagen.insert_one({"id": tv_id, "title": alt, "content": "",
        "doc_type": "projekt_kategorie", "text_type": "titel",
        "created_at": datetime.now(timezone.utc).isoformat()})
    await db.module_projekte.insert_one({"id": pj_id, "name": "ZZ Testprojekt",
        "kategorie": alt, "status": "Aktiv",
        "created_at": datetime.now(timezone.utc).isoformat()})
    print(f"[setup] Textvorlage + Projekt mit Kategorie '{alt}' angelegt")

    # 2) Login
    login = http("POST", "/api/auth/login", body={"username": "thorsten.graupner", "password": "Thorsten2026!"})
    token = login.get("token") or login.get("access_token")
    print("[login] ok" if token else "[login] FEHLGESCHLAGEN")

    # 3) Vorher-Zaehlung
    usage = http("GET", f"/api/modules/textvorlagen/category-usage?doc_type=projekt_kategorie&value={alt}", token)
    print(f"[usage] projekte_count={usage.get('projekte_count')} (erwartet 1)")

    # 4) Umbenennen
    res = http("POST", "/api/modules/textvorlagen/rename-category", token, {"item_id": tv_id, "new_name": neu})
    print(f"[rename] migrated={res.get('migrated')} orphans_remaining={res.get('orphans_remaining')} "
          f"backup={res.get('backup_collection')} backed_up={res.get('documents_backed_up')}")

    # 5) Verifikation in der DB
    pj = await db.module_projekte.find_one({"id": pj_id}, {"_id": 0, "kategorie": 1})
    tv = await db.module_textvorlagen.find_one({"id": tv_id}, {"_id": 0, "title": 1})
    orphan_alt = await db.module_projekte.count_documents({"kategorie": alt})
    backup_coll = res.get("backup_collection")
    backup_exists = backup_coll in (await db.list_collection_names()) if backup_coll else False
    print(f"[verify] Projekt.kategorie='{pj.get('kategorie')}' (erwartet {neu})")
    print(f"[verify] Textvorlage.title='{tv.get('title')}' (erwartet {neu})")
    print(f"[verify] verwaiste mit altem Namen='{alt}': {orphan_alt} (erwartet 0)")
    print(f"[verify] Backup-Collection mit Zeitstempel existiert: {backup_exists}")

    ok = (pj.get("kategorie") == neu and tv.get("title") == neu and orphan_alt == 0 and backup_exists
          and usage.get("projekte_count") == 1 and res.get("orphans_remaining") == 0)
    print("\n==> ERGEBNIS:", "BESTANDEN ✅" if ok else "FEHLGESCHLAGEN ❌")

    # 6) Cleanup
    await db.module_projekte.delete_one({"id": pj_id})
    await db.module_textvorlagen.delete_one({"id": tv_id})
    if backup_coll and backup_exists:
        await db.drop_collection(backup_coll)
    print("[cleanup] Testdaten + Backup-Collection entfernt")

asyncio.run(main())
