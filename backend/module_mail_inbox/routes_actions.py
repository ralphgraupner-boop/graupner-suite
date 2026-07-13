"""Aktions-Routen für module_mail_inbox: Akzeptieren, Verknüpfen, Ablehnen, Abschliessen."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from database import db, logger
from utils import get_default_kunden_status
from routes.auth import get_current_user
from .helpers import _find_kunde_duplicates, _tombstone

router = APIRouter()


@router.post("/begruessung-gesendet/{entry_id}")
async def begruessung_gesendet(entry_id: str, user=Depends(get_current_user)):
    """Markiert eine Anfrage nach gesendeter Begrüßungsmail als bearbeitet:
    status='übernommen', begruessung_gesendet=True, begruessung_at."""
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    now = datetime.now(timezone.utc).isoformat()
    await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {"status": "übernommen", "begruessung_gesendet": True, "begruessung_at": now}},
    )
    return {"ok": True, "id": entry_id, "status": "übernommen"}



@router.post("/accept/{entry_id}")
async def accept(entry_id: str, body: dict | None = None, user=Depends(get_current_user)):
    """Übernimmt eine Mail-Anfrage als neuen Kunden.

    Duplikatsschutz: Ist bereits ein Kunde mit gleicher E-Mail oder Telefon
    in module_kunden vorhanden, antwortet der Endpoint mit HTTP 409 und
    einer Liste der Kandidaten. Frontend kann dann
      • per /accept-link/{entry_id} an einen bestehenden Kunden anhängen,
      • oder /accept/{entry_id} mit body.force_new=true erneut aufrufen.

    Optional darf der Frontend-Body folgende Felder überschreiben/ergänzen:
      vorname, nachname, anrede, email, phone (= telefon), strasse, plz, ort,
      nachricht (Beschreibung des Anliegens), bemerkung, kontakt_status, customer_type, kategorie,
      force_new (bool, Default false)
    """
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    if entry.get("status") == "übernommen":
        raise HTTPException(400, "Bereits übernommen")
    parsed = entry.get("parsed") or {}
    body = body or {}

    def _pick(field_in_body: str, fallback: str = "") -> str:
        v = body.get(field_in_body)
        return v.strip() if isinstance(v, str) and v.strip() else fallback

    new_kunde_id = str(uuid.uuid4())
    vorname = _pick("vorname", parsed.get("vorname", ""))
    nachname = _pick("nachname", parsed.get("nachname", ""))
    anrede = _pick("anrede", parsed.get("anrede", ""))
    full_name = " ".join(p for p in [vorname, nachname] if p).strip()
    email_val = _pick("email", parsed.get("email") or entry.get("reply_to", "") or "")
    phone_val = _pick("phone", parsed.get("telefon", ""))

    # ── Duplikatsschutz ──
    if not body.get("force_new"):
        dups = await _find_kunde_duplicates(email_val, phone_val)
        if dups:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "duplicate_kunde",
                    "message": f"Kunde mit dieser E-Mail/Telefon existiert bereits ({len(dups)} Treffer).",
                    "duplicates": dups,
                    "entry_id": entry_id,
                },
            )

    new_kunde = {
        "id": new_kunde_id,
        "anrede": anrede,
        "vorname": vorname,
        "nachname": nachname,
        "name": full_name or entry.get("from_name", ""),
        "email": email_val,
        "phone": phone_val,
        "strasse": _pick("strasse", parsed.get("strasse", "")),
        "plz": _pick("plz", parsed.get("plz", "")),
        "ort": _pick("ort", parsed.get("ort", "")),
        "kontakt_status": _pick("kontakt_status", await get_default_kunden_status()),
        "customer_type": _pick("customer_type", "Privat"),
        "quelle": _pick("quelle", "Jimdo Kontaktformular"),
        "nachricht": _pick("nachricht", parsed.get("nachricht", "")),
        "bemerkung": _pick("bemerkung", ""),
        "categories": body.get("categories") if isinstance(body.get("categories"), list) else [],
        "source_url": parsed.get("source_url", ""),
        "created_at": entry.get("received_at") or datetime.now(timezone.utc).isoformat(),
        "created_by": getattr(user, "username", "system") if not isinstance(user, dict) else (user.get("username") or "system"),
        "imported_from_mail_id": entry_id,
    }
    await db.module_kunden.insert_one(new_kunde)

    await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {
            "status": "übernommen",
            "kunde_id": new_kunde_id,
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": user.get("username") if isinstance(user, dict) else getattr(user, "username", None),
        }},
    )
    return {"ok": True, "kunde_id": new_kunde_id, "kunde_name": new_kunde["name"]}


@router.post("/accept-link/{entry_id}")
async def accept_link(entry_id: str, body: dict, user=Depends(get_current_user)):
    """Ordnet eine Mail-Anfrage einem **bereits existierenden** Kunden zu,
    ohne einen neuen Kunden anzulegen.

    Body: { kunde_id: str, append_nachricht: bool=True }
    - Inbox-Eintrag wird auf status='übernommen' gesetzt + kunde_id eingetragen.
    - Leere Felder beim bestehenden Kunden (Anrede, Vorname, Nachname, Telefon,
      Straße, PLZ, Ort) werden automatisch aus der neuen Mail nachgefuellt,
      sofern der bestehende Kunde dort noch nichts gespeichert hat.
    - Optional wird die Anfrage-Nachricht als neuer Notiz-Block an die
      bestehende kunde.nachricht angehängt (mit Datums-Header), so dass
      keine bestehenden Daten überschrieben werden.
    """
    body = body or {}
    target_kunde_id = (body.get("kunde_id") or "").strip()
    if not target_kunde_id:
        raise HTTPException(400, "kunde_id fehlt")

    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    if entry.get("status") == "übernommen":
        raise HTTPException(400, "Bereits übernommen")

    kunde = await db.module_kunden.find_one({"id": target_kunde_id}, {"_id": 0})
    if not kunde:
        raise HTTPException(404, "Kunde nicht gefunden")

    parsed = entry.get("parsed") or {}
    new_nachricht = (parsed.get("nachricht") or "").strip()

    update_set = {}

    # ── Leere Felder beim bestehenden Kunden automatisch nachfuellen ──
    # Nur Felder, die beim bestehenden Kunden WIRKLICH leer sind, werden
    # aus der neuen (verknuepften) Mail ergaenzt. Bereits vorhandene Werte
    # bleiben unangetastet, damit nichts ueberschrieben wird.
    _fill_map = {
        "anrede": parsed.get("anrede", ""),
        "vorname": parsed.get("vorname", ""),
        "nachname": parsed.get("nachname", ""),
        "phone": parsed.get("telefon", ""),
        "strasse": parsed.get("strasse", ""),
        "plz": parsed.get("plz", ""),
        "ort": parsed.get("ort", ""),
    }
    for field, new_val in _fill_map.items():
        new_val = (new_val or "").strip()
        existing_val = (kunde.get(field) or "").strip()
        if new_val and not existing_val:
            update_set[field] = new_val

    # Name neu zusammensetzen, falls Vorname/Nachname ergaenzt wurden
    if "vorname" in update_set or "nachname" in update_set:
        vn = update_set.get("vorname", kunde.get("vorname", ""))
        nn = update_set.get("nachname", kunde.get("nachname", ""))
        joined = f"{(vn or '').strip()} {(nn or '').strip()}".strip()
        existing_name = (kunde.get("name") or "").strip()
        if joined and not existing_name:
            update_set["name"] = joined

    if body.get("append_nachricht", True) and new_nachricht:
        existing = (kunde.get("nachricht") or "").strip()
        stamp = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")
        block = f"[Neue Anfrage {stamp}]\n{new_nachricht}"
        merged = (existing + "\n\n" + block).strip() if existing else block
        update_set["nachricht"] = merged

    if update_set:
        update_set["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.module_kunden.update_one(
            {"id": target_kunde_id},
            {"$set": update_set},
        )

    await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {
            "status": "übernommen",
            "kunde_id": target_kunde_id,
            "linked_to_existing": True,
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": user.get("username") if isinstance(user, dict) else getattr(user, "username", None),
        }},
    )
    return {"ok": True, "kunde_id": target_kunde_id, "kunde_name": kunde.get("name", ""), "linked": True}


@router.post("/reject/{entry_id}")
async def reject(entry_id: str, user=Depends(get_current_user)):
    r = await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {
            "status": "ignoriert",
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": getattr(user, "username", None),
        }},
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Eintrag nicht gefunden")
    return {"ok": True}


@router.post("/reject-all-spam")
async def reject_all_spam(user=Depends(get_current_user)):
    """Massen-Ignorieren: alle Einträge mit Status 'spam_verdacht' auf 'ignoriert' setzen."""
    r = await db.module_mail_inbox.update_many(
        {"status": "spam_verdacht"},
        {"$set": {
            "status": "ignoriert",
            "user_action_at": datetime.now(timezone.utc).isoformat(),
            "user_action_by": getattr(user, "username", None),
            "auto_rejected_as_spam": True,
        }},
    )
    return {"ok": True, "rejected": r.modified_count}


@router.patch("/{entry_id}/projekt")
async def set_projekt(entry_id: str, body: dict, user=Depends(get_current_user)):
    """Setzt oder entfernt die optionale projekt_id bei einer Mail-Anfrage.
    Beim Setzen wird der Mailtext zusaetzlich mit Datum an die Projekt-Notizen angehaengt."""
    projekt_id = (body.get("projekt_id") or "").strip() or None
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {"projekt_id": projekt_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if projekt_id:
        parsed = entry.get("parsed") or {}
        mailtext = (parsed.get("nachricht") or entry.get("body_excerpt") or "").strip()
        if mailtext:
            projekt = await db.module_projekte.find_one({"id": projekt_id}, {"_id": 0})
            if projekt:
                zeitstempel = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M")
                subject = entry.get("subject") or ""
                neuer_eintrag = f"[Mail-Anfrage {zeitstempel}] {subject}\n{mailtext}"
                bestehende_notizen = (projekt.get("notizen") or "").strip()
                aktualisierte_notizen = f"{bestehende_notizen}\n\n{neuer_eintrag}".strip() if bestehende_notizen else neuer_eintrag
                await db.module_projekte.update_one(
                    {"id": projekt_id},
                    {"$set": {"notizen": aktualisierte_notizen, "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
    return {"ok": True, "projekt_id": projekt_id}



@router.post("/{entry_id}/abschliessen")
async def abschliessen(entry_id: str, body: dict, user=Depends(get_current_user)):
    """Anfrage abschließen mit Grund (statt löschen).
    Erwartet: { grund: str }  (Pflicht)
    Setzt: status='abgeschlossen', abschluss_grund, abschluss_at, abschluss_by
    Eintrag bleibt in der DB erhalten und ist im Archiv-Tab sichtbar.
    """
    grund = ((body or {}).get("grund") or "").strip()
    if not grund:
        raise HTTPException(400, "Grund ist erforderlich")
    entry = await db.module_mail_inbox.find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(404, "Eintrag nicht gefunden")
    now = datetime.now(timezone.utc).isoformat()
    await db.module_mail_inbox.update_one(
        {"id": entry_id},
        {"$set": {
            "status": "abgeschlossen",
            "abschluss_grund": grund,
            "abschluss_at": now,
            "abschluss_by": getattr(user, "username", None),
        }},
    )
    return {"ok": True, "id": entry_id, "status": "abgeschlossen"}
