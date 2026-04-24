"""Duplikate-Modul – Scan + Merge Routes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional
import re
import uuid

from database import db
from routes.auth import get_current_user

router = APIRouter()


# ==================== Utils ====================

def _norm_name(s: str) -> str:
    if not s:
        return ""
    # Zusammenfuehren: Leerzeichen kollabieren, trim, lowercase
    return re.sub(r"\s+", " ", s).strip().lower()


def _norm_phone(s: str) -> str:
    if not s:
        return ""
    # Nur Ziffern; fuehrende 0/00/+ ignorieren fuer Vergleich
    digits = re.sub(r"\D", "", s)
    # '0049...' oder '+49...' -> '49...'
    if digits.startswith("00"):
        digits = digits[2:]
    # Mindestlaenge gegen False-Positives (Kurzwahlen, Notfallnummern, Durchwahlen)
    if len(digits) < 6:
        return ""
    return digits


def _norm_email(s: str) -> str:
    return (s or "").strip().lower()


def _kunde_name(k: dict) -> str:
    n = (k.get("name") or "").strip()
    if n:
        return n
    vn = (k.get("vorname") or "").strip()
    nn = (k.get("nachname") or "").strip()
    if vn or nn:
        return f"{vn} {nn}".strip()
    return (k.get("firma") or "").strip()


def _pair_key(a_id: str, b_id: str) -> str:
    return "|".join(sorted([a_id, b_id]))


# ==================== Scan ====================

@router.get("/scan")
async def scan_duplicates(user=Depends(get_current_user)):
    """Scannt module_kunden nach potentiellen Duplikaten.

    Heuristik: E-Mail ODER (Name + PLZ) ODER (Name + Telefon).
    Bereits ignorierte Paare werden uebersprungen.
    Archivierte Kunden (kontakt_status == 'Archiv') werden uebersprungen,
    weil sie nicht mehr aktiv sind.
    """
    kunden = await db.module_kunden.find(
        {"kontakt_status": {"$ne": "Archiv"}}, {"_id": 0}
    ).to_list(20000)

    ignored_docs = await db.duplikate_ignored.find({}, {"_id": 0}).to_list(10000)
    ignored_keys = {d.get("pair_key") for d in ignored_docs if d.get("pair_key")}

    # Index nach Email / (Name+PLZ) / (Name+Phone)
    by_email: dict[str, list[dict]] = {}
    by_name_plz: dict[str, list[dict]] = {}
    by_name_phone: dict[str, list[dict]] = {}

    for k in kunden:
        email = _norm_email(k.get("email"))
        name = _norm_name(_kunde_name(k))
        plz = (k.get("plz") or "").strip()
        phone = _norm_phone(k.get("phone") or k.get("mobile") or k.get("telefon"))
        if email:
            by_email.setdefault(email, []).append(k)
        if name and plz:
            by_name_plz.setdefault(f"{name}|{plz}", []).append(k)
        if name and phone:
            by_name_phone.setdefault(f"{name}|{phone}", []).append(k)

    # Paare sammeln (deduplizieren ueber pair_key)
    pairs: dict[str, dict] = {}

    def add_pair(a: dict, b: dict, reason: str):
        if a["id"] == b["id"]:
            return
        key = _pair_key(a["id"], b["id"])
        if key in ignored_keys:
            return
        if key in pairs:
            reasons = pairs[key]["reasons"]
            if reason not in reasons:
                reasons.append(reason)
            return
        pairs[key] = {
            "pair_key": key,
            "a": _kunde_preview(a),
            "b": _kunde_preview(b),
            "reasons": [reason],
        }

    for email, group in by_email.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                add_pair(group[i], group[j], "email")

    for key, group in by_name_plz.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                add_pair(group[i], group[j], "name_plz")

    for key, group in by_name_phone.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                add_pair(group[i], group[j], "name_phone")

    return {
        "total_kunden_scanned": len(kunden),
        "pair_count": len(pairs),
        "ignored_count": len(ignored_keys),
        "pairs": list(pairs.values()),
    }


def _kunde_preview(k: dict) -> dict:
    """Kompakte Vorschau fuer das Scan-Ergebnis (Liste)."""
    return {
        "id": k["id"],
        "name": _kunde_name(k) or "(ohne Name)",
        "email": k.get("email", ""),
        "phone": k.get("phone", "") or k.get("mobile", "") or k.get("telefon", ""),
        "plz": k.get("plz", ""),
        "ort": k.get("ort", ""),
        "firma": k.get("firma", ""),
        "kontakt_status": k.get("kontakt_status", ""),
        "source": k.get("source", ""),
        "created_at": k.get("created_at", ""),
        "updated_at": k.get("updated_at", ""),
    }


# ==================== Paar-Detail ====================

@router.get("/pair")
async def get_pair(a_id: str, b_id: str, user=Depends(get_current_user)):
    """Liefert zwei vollstaendige Kunden-Datensaetze + Zusatz-Statistik fuer die Merge-Ansicht."""
    a = await db.module_kunden.find_one({"id": a_id}, {"_id": 0})
    b = await db.module_kunden.find_one({"id": b_id}, {"_id": 0})
    if not a or not b:
        raise HTTPException(404, "Kunde(n) nicht gefunden")

    # Zusatz-Statistik (nur lesend, zur Entscheidungshilfe)
    stats = {}
    for kid in (a_id, b_id):
        stats[kid] = {
            "dokumente_v2": await db.dokumente_v2.count_documents({"parent_id": kid}),
            "einsaetze": await db.einsaetze.count_documents({"kunde_id": kid}),
            "monteur_fotos": await db.monteur_app_fotos.count_documents({"kunde_id": kid}),
            "monteur_notizen": await db.monteur_app_notizen.count_documents({"kunde_id": kid}),
        }
    return {"a": a, "b": b, "stats": stats, "pair_key": _pair_key(a_id, b_id)}


# ==================== Ignorieren ====================

class IgnorePayload(BaseModel):
    a_id: str
    b_id: str
    note: Optional[str] = None


@router.post("/ignore")
async def ignore_pair(payload: IgnorePayload, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    key = _pair_key(payload.a_id, payload.b_id)
    existing = await db.duplikate_ignored.find_one({"pair_key": key})
    if existing:
        return {"pair_key": key, "already_ignored": True}
    doc = {
        "id": str(uuid.uuid4()),
        "pair_key": key,
        "a_id": payload.a_id,
        "b_id": payload.b_id,
        "note": payload.note or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.get("username") or user.get("email") or "admin",
    }
    await db.duplikate_ignored.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/ignore")
async def unignore_pair(a_id: str, b_id: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    key = _pair_key(a_id, b_id)
    res = await db.duplikate_ignored.delete_one({"pair_key": key})
    return {"pair_key": key, "deleted": res.deleted_count}


# ==================== Merge ====================

class MergePayload(BaseModel):
    winner_id: str
    loser_id: str
    # Finales Feld-Mapping: {feldname: final_value}
    # Nur Felder, die hier enthalten sind, werden auf den Winner geschrieben.
    merged_fields: dict = Field(default_factory=dict)


# Felder, die NIEMALS ueberschrieben werden (Identitaet/Metadaten)
_PROTECTED_FIELDS = {"id", "_id", "created_at"}


@router.post("/merge")
async def merge_pair(payload: MergePayload, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Nur Admins")
    if payload.winner_id == payload.loser_id:
        raise HTTPException(400, "Sieger und Verlierer duerfen nicht identisch sein")

    winner = await db.module_kunden.find_one({"id": payload.winner_id})
    loser = await db.module_kunden.find_one({"id": payload.loser_id})
    if not winner or not loser:
        raise HTTPException(404, "Kunde(n) nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()

    # Winner aktualisieren – nur erlaubte Felder
    update = {k: v for k, v in (payload.merged_fields or {}).items()
              if k not in _PROTECTED_FIELDS}
    # Wenn kontakt_status in der Auswahl ist, auch legacy status angleichen
    if "kontakt_status" in update and update["kontakt_status"]:
        update["status"] = update["kontakt_status"]
    elif "status" in update and update["status"]:
        update["kontakt_status"] = update["status"]
    # Name / Adresse neu berechnen, falls Teilfelder geaendert wurden
    vn = update.get("vorname", winner.get("vorname", ""))
    nn = update.get("nachname", winner.get("nachname", ""))
    if ("vorname" in update) or ("nachname" in update):
        joined = f"{(vn or '').strip()} {(nn or '').strip()}".strip()
        if joined:
            update["name"] = joined
    strasse = update.get("strasse", winner.get("strasse", ""))
    hausnummer = update.get("hausnummer", winner.get("hausnummer", ""))
    plz = update.get("plz", winner.get("plz", ""))
    ort = update.get("ort", winner.get("ort", ""))
    if any(f in update for f in ("strasse", "hausnummer", "plz", "ort")):
        addr = f"{strasse} {hausnummer}, {plz} {ort}".strip().strip(",").strip()
        if addr:
            update["address"] = addr
    update["updated_at"] = now
    # Merge-Marker-Notiz: IMMER anhaengen – auch wenn Admin notes in merged_fields geschickt hat
    merge_note = (
        f"[{now[:10]}] Datensatz verschmolzen mit {loser.get('name') or loser['id']} "
        f"(ID {loser['id']})."
    )
    base_notes = update.get("notes")
    if base_notes is None:
        base_notes = winner.get("notes") or ""
    update["notes"] = (base_notes + ("\n" if base_notes else "") + merge_note)

    await db.module_kunden.update_one({"id": payload.winner_id}, {"$set": update})

    # Loser archivieren + markieren
    loser_note = (
        f"[{now[:10]}] Duplikat-Verschmelzung: Daten wurden in Kunde "
        f"{winner.get('name') or winner['id']} (ID {winner['id']}) uebernommen."
    )
    loser_old_notes = loser.get("notes") or ""
    await db.module_kunden.update_one(
        {"id": payload.loser_id},
        {"$set": {
            "kontakt_status": "Archiv",
            "status": "Archiv",
            "merged_into_id": payload.winner_id,
            "merged_at": now,
            "notes": loser_old_notes + ("\n" if loser_old_notes else "") + loser_note,
            "updated_at": now,
        }},
    )

    # Audit-Log
    log = {
        "id": str(uuid.uuid4()),
        "winner_id": payload.winner_id,
        "loser_id": payload.loser_id,
        "winner_name": _kunde_name(winner),
        "loser_name": _kunde_name(loser),
        "merged_fields": payload.merged_fields or {},
        "merged_field_keys": list((payload.merged_fields or {}).keys()),
        "timestamp": now,
        "executed_by": user.get("username") or user.get("email") or "admin",
    }
    await db.duplikate_merge_log.insert_one(log)
    log.pop("_id", None)

    winner_after = await db.module_kunden.find_one({"id": payload.winner_id}, {"_id": 0})
    return {"success": True, "winner": winner_after, "log": log}


# ==================== Merge-Log ====================

@router.get("/log")
async def get_merge_log(limit: int = 100, user=Depends(get_current_user)):
    items = await db.duplikate_merge_log.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return items
