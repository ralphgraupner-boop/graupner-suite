from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from datetime import datetime, timezone, date
from bson import ObjectId
from database import db
from auth import get_current_user
import uuid

router = APIRouter()


async def check_berechtigung(user: dict, bereich: str):
    """Prüft ob der Benutzer die Berechtigung für einen bestimmten Bereich hat."""
    if user.get("role") == "admin":
        return True
    db_user = await db.users.find_one({"username": user.get("username")}, {"_id": 0, "berechtigungen": 1, "role": 1})
    if not db_user:
        return False
    from routes.auth import get_default_berechtigungen
    perms = db_user.get("berechtigungen", get_default_berechtigungen(db_user.get("role", "")))
    return perms.get(bereich, False)


def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def serialize_list(docs):
    return [serialize_doc(d) for d in docs]


# ──────────────────── MITARBEITER CRUD ────────────────────

@router.get("/mitarbeiter")
async def list_mitarbeiter(user=Depends(get_current_user)):
    docs = await db.mitarbeiter.find({}, {"_id": 0}).sort("nachname", 1).to_list(200)
    return docs


@router.get("/mitarbeiter/{ma_id}")
async def get_mitarbeiter(ma_id: str, user=Depends(get_current_user)):
    doc = await db.mitarbeiter.find_one({"id": ma_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    return doc


@router.post("/mitarbeiter")
async def create_mitarbeiter(data: dict, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_anlegen_loeschen"):
        raise HTTPException(403, "Keine Berechtigung zum Anlegen von Mitarbeitern")
    ma_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": ma_id,
        "personalnummer": data.get("personalnummer", ""),
        "anrede": data.get("anrede", "Herr"),
        "vorname": data.get("vorname", ""),
        "nachname": data.get("nachname", ""),
        "geburtsdatum": data.get("geburtsdatum", ""),
        "strasse": data.get("strasse", ""),
        "plz": data.get("plz", ""),
        "ort": data.get("ort", ""),
        "telefon": data.get("telefon", ""),
        "email": data.get("email", ""),
        "position": data.get("position", ""),
        "beschaeftigungsart": data.get("beschaeftigungsart", ""),
        "wochenstunden": data.get("wochenstunden", 40),
        "eintrittsdatum": data.get("eintrittsdatum", ""),
        "austrittsdatum": data.get("austrittsdatum", ""),
        "status": data.get("status", "aktiv"),
        # Steuer & Sozialversicherung
        "steuer_id": data.get("steuer_id", ""),
        "sv_nummer": data.get("sv_nummer", ""),
        "krankenkasse": data.get("krankenkasse", ""),
        "steuerklasse": data.get("steuerklasse", ""),
        "kinderfreibetraege": data.get("kinderfreibetraege", 0),
        "konfession": data.get("konfession", "keine"),
        "personengruppe": data.get("personengruppe", "101 - Sozialversicherungspflichtig Beschäftigte ohne besondere Merkmale"),
        # Bankverbindung
        "iban": data.get("iban", ""),
        "bank": data.get("bank", ""),
        # Führerschein
        "fuehrerschein": data.get("fuehrerschein", ""),
        # Lohn
        "lohnart": data.get("lohnart", "stundenlohn"),
        "stundenlohn": data.get("stundenlohn", 0),
        "monatsgehalt": data.get("monatsgehalt", 0),
        "vwl_betrag": data.get("vwl_betrag", 0),
        "vwl_ag_anteil": data.get("vwl_ag_anteil", 0),
        # Urlaub
        "urlaubsanspruch": data.get("urlaubsanspruch", 30),
        # Notfallkontakt
        "notfallkontakt_name": data.get("notfallkontakt_name", ""),
        "notfallkontakt_telefon": data.get("notfallkontakt_telefon", ""),
        "notfallkontakt_beziehung": data.get("notfallkontakt_beziehung", ""),
        # Bemerkungen
        "bemerkungen": data.get("bemerkungen", ""),
        # Foto
        "foto_url": data.get("foto_url", ""),
        # Timestamps
        "created_at": now,
        "updated_at": now,
    }
    await db.mitarbeiter.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/mitarbeiter/{ma_id}")
async def update_mitarbeiter(ma_id: str, data: dict, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_stammdaten"):
        raise HTTPException(403, "Keine Berechtigung zum Bearbeiten von Stammdaten")
    data.pop("id", None)
    data.pop("_id", None)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.mitarbeiter.update_one({"id": ma_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    return {"message": "Gespeichert"}


@router.delete("/mitarbeiter/{ma_id}")
async def delete_mitarbeiter(ma_id: str, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_anlegen_loeschen"):
        raise HTTPException(403, "Keine Berechtigung zum Löschen von Mitarbeitern")
    result = await db.mitarbeiter.delete_one({"id": ma_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")
    await db.mitarbeiter_urlaub.delete_many({"mitarbeiter_id": ma_id})
    await db.mitarbeiter_krankmeldungen.delete_many({"mitarbeiter_id": ma_id})
    await db.mitarbeiter_lohnhistorie.delete_many({"mitarbeiter_id": ma_id})
    await db.mitarbeiter_dokumente.delete_many({"mitarbeiter_id": ma_id})
    await db.mitarbeiter_fortbildungen.delete_many({"mitarbeiter_id": ma_id})
    return {"message": "Mitarbeiter gelöscht"}


# ──────────────────── URLAUB ────────────────────

@router.get("/mitarbeiter/{ma_id}/urlaub")
async def get_urlaub(ma_id: str, user=Depends(get_current_user)):
    docs = await db.mitarbeiter_urlaub.find({"mitarbeiter_id": ma_id}, {"_id": 0}).sort("von", -1).to_list(500)
    return docs


@router.post("/mitarbeiter/{ma_id}/urlaub")
async def create_urlaub(ma_id: str, data: dict, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_urlaub"):
        raise HTTPException(403, "Keine Berechtigung für Urlaubsverwaltung")
    entry_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": entry_id,
        "mitarbeiter_id": ma_id,
        "von": data.get("von", ""),
        "bis": data.get("bis", ""),
        "tage": data.get("tage", 0),
        "typ": data.get("typ", "urlaub"),
        "status": data.get("status", "genehmigt"),
        "bemerkung": data.get("bemerkung", ""),
        "created_at": now,
    }
    await db.mitarbeiter_urlaub.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/mitarbeiter/{ma_id}/urlaub/{entry_id}")
async def update_urlaub(ma_id: str, entry_id: str, data: dict, user=Depends(get_current_user)):
    data.pop("id", None)
    data.pop("_id", None)
    result = await db.mitarbeiter_urlaub.update_one({"id": entry_id, "mitarbeiter_id": ma_id}, {"$set": data})
    if result.matched_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"message": "Aktualisiert"}


@router.delete("/mitarbeiter/{ma_id}/urlaub/{entry_id}")
async def delete_urlaub(ma_id: str, entry_id: str, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_urlaub"):
        raise HTTPException(403, "Keine Berechtigung für Urlaubsverwaltung")
    result = await db.mitarbeiter_urlaub.delete_one({"id": entry_id, "mitarbeiter_id": ma_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"message": "Gelöscht"}


# ──────────────────── KRANKMELDUNGEN ────────────────────

@router.get("/mitarbeiter/{ma_id}/krankmeldungen")
async def get_krankmeldungen(ma_id: str, user=Depends(get_current_user)):
    docs = await db.mitarbeiter_krankmeldungen.find({"mitarbeiter_id": ma_id}, {"_id": 0}).sort("von", -1).to_list(500)
    return docs


@router.post("/mitarbeiter/{ma_id}/krankmeldungen")
async def create_krankmeldung(ma_id: str, data: dict, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_krankmeldungen"):
        raise HTTPException(403, "Keine Berechtigung für Krankmeldungen")
    entry_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": entry_id,
        "mitarbeiter_id": ma_id,
        "von": data.get("von", ""),
        "bis": data.get("bis", ""),
        "tage": data.get("tage", 0),
        "au_bescheinigung": data.get("au_bescheinigung", False),
        "arzt": data.get("arzt", ""),
        "bemerkung": data.get("bemerkung", ""),
        "created_at": now,
    }
    await db.mitarbeiter_krankmeldungen.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/mitarbeiter/{ma_id}/krankmeldungen/{entry_id}")
async def delete_krankmeldung(ma_id: str, entry_id: str, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_krankmeldungen"):
        raise HTTPException(403, "Keine Berechtigung für Krankmeldungen")
    result = await db.mitarbeiter_krankmeldungen.delete_one({"id": entry_id, "mitarbeiter_id": ma_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"message": "Gelöscht"}


# ──────────────────── LOHNHISTORIE ────────────────────

@router.get("/mitarbeiter/{ma_id}/lohnhistorie")
async def get_lohnhistorie(ma_id: str, user=Depends(get_current_user)):
    docs = await db.mitarbeiter_lohnhistorie.find({"mitarbeiter_id": ma_id}, {"_id": 0}).sort("gueltig_ab", -1).to_list(200)
    return docs


@router.post("/mitarbeiter/{ma_id}/lohnhistorie")
async def create_lohnhistorie(ma_id: str, data: dict, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_lohn"):
        raise HTTPException(403, "Keine Berechtigung für Lohn & Gehalt")
    entry_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": entry_id,
        "mitarbeiter_id": ma_id,
        "gueltig_ab": data.get("gueltig_ab", ""),
        "lohnart": data.get("lohnart", "stundenlohn"),
        "stundenlohn": data.get("stundenlohn", 0),
        "monatsgehalt": data.get("monatsgehalt", 0),
        "bemerkung": data.get("bemerkung", ""),
        "created_at": now,
    }
    await db.mitarbeiter_lohnhistorie.insert_one(doc)
    doc.pop("_id", None)
    # Update current salary on employee
    update = {}
    if data.get("lohnart") == "stundenlohn":
        update = {"lohnart": "stundenlohn", "stundenlohn": data.get("stundenlohn", 0)}
    else:
        update = {"lohnart": "monatsgehalt", "monatsgehalt": data.get("monatsgehalt", 0)}
    await db.mitarbeiter.update_one({"id": ma_id}, {"$set": update})
    return doc


# ──────────────────── DOKUMENTE ────────────────────

@router.get("/mitarbeiter/{ma_id}/dokumente")
async def get_dokumente(ma_id: str, user=Depends(get_current_user)):
    docs = await db.mitarbeiter_dokumente.find({"mitarbeiter_id": ma_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@router.post("/mitarbeiter/{ma_id}/dokumente")
async def upload_dokument(ma_id: str, file: UploadFile = File(...), kategorie: str = Form("sonstiges"), user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_dokumente"):
        raise HTTPException(403, "Keine Berechtigung für Dokumente")
    from utils.storage import put_object
    content = await file.read()
    storage_key = f"mitarbeiter/{ma_id}/{uuid.uuid4().hex[:8]}_{file.filename}"
    result = put_object(storage_key, content, file.content_type)
    url = result.get("url", "")
    entry_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": entry_id,
        "mitarbeiter_id": ma_id,
        "filename": file.filename,
        "storage_key": storage_key,
        "url": url,
        "content_type": file.content_type,
        "kategorie": kategorie,
        "created_at": now,
    }
    await db.mitarbeiter_dokumente.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/mitarbeiter/{ma_id}/dokumente/{doc_id}")
async def delete_dokument(ma_id: str, doc_id: str, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_dokumente"):
        raise HTTPException(403, "Keine Berechtigung für Dokumente")
    result = await db.mitarbeiter_dokumente.delete_one({"id": doc_id, "mitarbeiter_id": ma_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Dokument nicht gefunden")
    return {"message": "Gelöscht"}


# ──────────────────── FORTBILDUNGEN ────────────────────

@router.get("/mitarbeiter/{ma_id}/fortbildungen")
async def get_fortbildungen(ma_id: str, user=Depends(get_current_user)):
    docs = await db.mitarbeiter_fortbildungen.find({"mitarbeiter_id": ma_id}, {"_id": 0}).sort("datum", -1).to_list(200)
    return docs


@router.post("/mitarbeiter/{ma_id}/fortbildungen")
async def create_fortbildung(ma_id: str, data: dict, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_fortbildungen"):
        raise HTTPException(403, "Keine Berechtigung für Fortbildungen")
    entry_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": entry_id,
        "mitarbeiter_id": ma_id,
        "bezeichnung": data.get("bezeichnung", ""),
        "anbieter": data.get("anbieter", ""),
        "datum": data.get("datum", ""),
        "bis_datum": data.get("bis_datum", ""),
        "kosten": data.get("kosten", 0),
        "zertifikat": data.get("zertifikat", False),
        "bemerkung": data.get("bemerkung", ""),
        "created_at": now,
    }
    await db.mitarbeiter_fortbildungen.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/mitarbeiter/{ma_id}/fortbildungen/{entry_id}")
async def delete_fortbildung(ma_id: str, entry_id: str, user=Depends(get_current_user)):
    if not await check_berechtigung(user, "mitarbeiter_fortbildungen"):
        raise HTTPException(403, "Keine Berechtigung für Fortbildungen")
    result = await db.mitarbeiter_fortbildungen.delete_one({"id": entry_id, "mitarbeiter_id": ma_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"message": "Gelöscht"}


# ──────────────────── KALENDER / ABWESENHEITEN ────────────────────

@router.get("/mitarbeiter-abwesenheiten")
async def get_all_abwesenheiten(user=Depends(get_current_user)):
    """Alle Urlaube und Krankmeldungen aller Mitarbeiter für Kalenderansicht"""
    mitarbeiter = await db.mitarbeiter.find({}, {"_id": 0, "id": 1, "vorname": 1, "nachname": 1}).to_list(200)
    ma_map = {m["id"]: f"{m['vorname']} {m['nachname']}" for m in mitarbeiter}

    urlaube = await db.mitarbeiter_urlaub.find({}, {"_id": 0}).to_list(1000)
    krankmeldungen = await db.mitarbeiter_krankmeldungen.find({}, {"_id": 0}).to_list(1000)

    events = []
    for u in urlaube:
        name = ma_map.get(u["mitarbeiter_id"], "Unbekannt")
        events.append({
            "id": u["id"],
            "mitarbeiter_id": u["mitarbeiter_id"],
            "name": name,
            "von": u["von"],
            "bis": u["bis"],
            "typ": u.get("typ", "urlaub"),
            "status": u.get("status", "genehmigt"),
            "tage": u.get("tage", 0),
        })
    for k in krankmeldungen:
        name = ma_map.get(k["mitarbeiter_id"], "Unbekannt")
        events.append({
            "id": k["id"],
            "mitarbeiter_id": k["mitarbeiter_id"],
            "name": name,
            "von": k["von"],
            "bis": k["bis"],
            "typ": "krank",
            "status": "bestätigt",
            "tage": k.get("tage", 0),
        })

    return events


# ──────────────────── STATISTIKEN ────────────────────

@router.get("/mitarbeiter/{ma_id}/statistiken")
async def get_statistiken(ma_id: str, user=Depends(get_current_user)):
    ma = await db.mitarbeiter.find_one({"id": ma_id}, {"_id": 0})
    if not ma:
        raise HTTPException(404, "Mitarbeiter nicht gefunden")

    year = datetime.now().year
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"

    urlaube = await db.mitarbeiter_urlaub.find({
        "mitarbeiter_id": ma_id,
        "von": {"$gte": year_start, "$lte": year_end},
        "status": {"$in": ["genehmigt", "genommen"]}
    }, {"_id": 0}).to_list(500)

    krankmeldungen = await db.mitarbeiter_krankmeldungen.find({
        "mitarbeiter_id": ma_id,
        "von": {"$gte": year_start, "$lte": year_end}
    }, {"_id": 0}).to_list(500)

    urlaub_genommen = sum(u.get("tage", 0) for u in urlaube)
    anspruch = ma.get("urlaubsanspruch", 30)
    krank_tage = sum(k.get("tage", 0) for k in krankmeldungen)

    return {
        "year": year,
        "urlaubsanspruch": anspruch,
        "urlaub_genommen": urlaub_genommen,
        "urlaub_rest": anspruch - urlaub_genommen,
        "kranktage": krank_tage,
        "krankmeldungen_anzahl": len(krankmeldungen),
    }


# ──────────────────── LEXWARE IMPORT ────────────────────

@router.post("/lexware-import/parse")
async def parse_lexware_upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Parst eine Lexware ZIP-Datei und gibt die erkannten Daten zurück (Vorschau)."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins dürfen importieren")

    import tempfile, os
    from utils.lexware_parser import parse_lexware_zip

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        results = parse_lexware_zip(tmp_path)
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(400, f"Fehler beim Parsen: {str(e)}")
    finally:
        os.unlink(tmp_path)

    # Match each result to existing Mitarbeiter
    all_ma = await db.mitarbeiter.find({}, {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "personalnummer": 1}).to_list(200)

    preview = []
    for r in results:
        matched_ma = None
        for ma in all_ma:
            if ma.get("vorname", "").lower() == r.get("vorname", "").lower() and ma.get("nachname", "").lower() == r.get("nachname", "").lower():
                matched_ma = ma
                break

        # Clean up internal fields
        display = {k: v for k, v in r.items() if not k.startswith("_")}
        preview.append({
            "parsed_data": display,
            "matched_mitarbeiter": matched_ma,
            "source_file": r.get("_source_file", ""),
        })

        # Clean up temp PDF files
        pdf_path = r.get("_pdf_path")
        if pdf_path:
            try:
                os.unlink(pdf_path)
            except OSError:
                pass

    return preview


@router.post("/lexware-import/execute")
async def execute_lexware_import(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Führt den Lexware-Import aus: Stammdaten aktualisieren + PDFs als Dokumente speichern."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins dürfen importieren")

    import tempfile, os
    from utils.lexware_parser import parse_lexware_zip
    from utils.storage import put_object
    import zipfile

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        results = parse_lexware_zip(tmp_path)
    except Exception as e:
        os.unlink(tmp_path)
        raise HTTPException(400, f"Fehler beim Parsen: {str(e)}")

    all_ma = await db.mitarbeiter.find({}, {"_id": 0}).to_list(200)
    now = datetime.now(timezone.utc).isoformat()

    import_log = []

    for r in results:
        vorname = r.get("vorname", "")
        nachname = r.get("nachname", "")

        # Find matching Mitarbeiter
        matched = None
        for ma in all_ma:
            if ma.get("vorname", "").lower() == vorname.lower() and ma.get("nachname", "").lower() == nachname.lower():
                matched = ma
                break

        # If no match, create new
        if not matched:
            ma_id = str(uuid.uuid4())[:8]
            new_doc = {
                "id": ma_id,
                "status": "aktiv",
                "created_at": now,
                "updated_at": now,
            }
            # Fill all fields from parsed data
            stamm_fields = ["anrede", "vorname", "nachname", "strasse", "plz", "ort",
                           "personalnummer", "geburtsdatum", "steuerklasse", "konfession",
                           "sv_nummer", "krankenkasse", "personengruppe", "beschaeftigungsart",
                           "eintrittsdatum", "steuer_id", "bank", "iban",
                           "monatsgehalt", "stundenlohn", "lohnart", "kinderfreibetraege"]
            for f in stamm_fields:
                if f in r:
                    new_doc[f] = r[f]
            await db.mitarbeiter.insert_one(new_doc)
            new_doc.pop("_id", None)
            matched = new_doc
            import_log.append({"name": f"{vorname} {nachname}", "action": "neu_angelegt", "id": ma_id})
        else:
            # Update existing
            ma_id = matched["id"]
            update_fields = {}
            stamm_fields = ["anrede", "strasse", "plz", "ort", "geburtsdatum",
                           "steuerklasse", "konfession", "sv_nummer", "krankenkasse",
                           "personengruppe", "beschaeftigungsart", "eintrittsdatum",
                           "steuer_id", "bank", "iban", "monatsgehalt", "stundenlohn",
                           "lohnart", "kinderfreibetraege"]
            for f in stamm_fields:
                if f in r and r[f]:
                    update_fields[f] = r[f]
            # Update personalnummer only if not set
            if r.get("personalnummer") and not matched.get("personalnummer"):
                update_fields["personalnummer"] = r["personalnummer"]
            if update_fields:
                update_fields["updated_at"] = now
                await db.mitarbeiter.update_one({"id": ma_id}, {"$set": update_fields})
            import_log.append({"name": f"{vorname} {nachname}", "action": "aktualisiert", "id": ma_id, "fields": list(update_fields.keys())})

        # Store PDF as document (skip if same filename already exists for this employee)
        pdf_path = r.get("_pdf_path")
        if pdf_path and os.path.exists(pdf_path):
            pdf_filename = r.get("_source_file", f"{vorname}_{nachname}_Lohnabrechnung.pdf")
            existing_doc = await db.mitarbeiter_dokumente.find_one(
                {"mitarbeiter_id": ma_id, "filename": pdf_filename}, {"_id": 1}
            )
            if not existing_doc:
                with open(pdf_path, "rb") as f:
                    pdf_content = f.read()
                storage_key = f"mitarbeiter/{ma_id}/lexware/{uuid.uuid4().hex[:8]}_{pdf_filename}"
                result = put_object(storage_key, pdf_content, "application/pdf")
                url = result.get("url", "")
                doc_entry = {
                    "id": str(uuid.uuid4())[:8],
                    "mitarbeiter_id": ma_id,
                    "filename": pdf_filename,
                    "storage_key": storage_key,
                    "url": url,
                    "content_type": "application/pdf",
                    "kategorie": "entgelt::Verdienstbescheinigung",
                    "created_at": now,
                }
                await db.mitarbeiter_dokumente.insert_one(doc_entry)
                doc_entry.pop("_id", None)

            os.unlink(pdf_path)

        # Add to Lohnhistorie (skip if same month already imported)
        if r.get("lohnart") and (r.get("monatsgehalt") or r.get("stundenlohn")):
            bemerkung = f"Lexware Import {r.get('abrechnungsmonat', '')}"
            existing_lohn = await db.mitarbeiter_lohnhistorie.find_one(
                {"mitarbeiter_id": ma_id, "bemerkung": bemerkung}, {"_id": 1}
            )
            if not existing_lohn:
                lohn_entry = {
                    "id": str(uuid.uuid4())[:8],
                    "mitarbeiter_id": ma_id,
                    "gueltig_ab": r.get("eintrittsdatum", now[:10]),
                    "lohnart": r["lohnart"],
                    "stundenlohn": r.get("stundenlohn", 0),
                    "monatsgehalt": r.get("monatsgehalt", 0),
                    "bemerkung": bemerkung,
                    "created_at": now,
                }
                await db.mitarbeiter_lohnhistorie.insert_one(lohn_entry)
                lohn_entry.pop("_id", None)
            else:
                # Update existing entry with latest values
                await db.mitarbeiter_lohnhistorie.update_one(
                    {"mitarbeiter_id": ma_id, "bemerkung": bemerkung},
                    {"$set": {
                        "lohnart": r["lohnart"],
                        "stundenlohn": r.get("stundenlohn", 0),
                        "monatsgehalt": r.get("monatsgehalt", 0),
                        "updated_at": now,
                    }}
                )

    # Cleanup
    try:
        os.unlink(tmp_path)
    except OSError:
        pass

    return {"message": f"{len(results)} Mitarbeiter importiert", "log": import_log}
