"""Routes für module_wolke — siehe __init__.py."""
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import db
from routes.auth import get_current_user

router = APIRouter()

VALID_TYPES = ["memo", "aufgabe"]
VALID_STATUS = ["offen", "erledigt", "archiviert"]

# Auto-Archivierung: erledigte UND gelesene Nachrichten aelter als X Tage -> Status 'archiviert'.
ARCHIV_TAGE = 30

# Push-Retry Defaults (User-Entscheidung 03.06.2026): 5 Min Intervall, 10 Versuche
WOLKE_RETRY_INTERVALL_MIN = 5
WOLKE_MAX_VERSUCHE = 10


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _now_iso() -> str:
    return _iso(datetime.now(timezone.utc))


async def _resolve_user_to_recipient(user) -> dict:
    """Liefert ein einheitliches Empfänger/Absender-Objekt für den eingeloggten User.

    Reihenfolge:
      1) Mitarbeiter-Doc, falls per (vorname+nachname) oder email gefunden  → id = mitarbeiter.id
      2) Sonst synthetisches Doc mit id = 'user:' + username (für reine Admin-Accounts ohne Mitarbeiter-Eintrag).

    Liefert immer ein Objekt mit mindestens {id, vorname, nachname, email, source}.
    """
    username = (getattr(user, "username", "") or (user or {}).get("username", "") or "").strip()
    email = (getattr(user, "email", "") or (user or {}).get("email", "") or "").strip()
    if username:
        parts = username.split()
        if len(parts) >= 2:
            m = await db.mitarbeiter.find_one(
                {"vorname": parts[0], "nachname": " ".join(parts[1:])},
                {"_id": 0},
            )
            if m:
                return {**m, "source": "mitarbeiter"}
        m = await db.mitarbeiter.find_one(
            {"$expr": {"$eq": [{"$concat": ["$vorname", " ", "$nachname"]}, username]}},
            {"_id": 0},
        )
        if m:
            return {**m, "source": "mitarbeiter"}
    if email:
        m = await db.mitarbeiter.find_one({"email": email}, {"_id": 0})
        if m:
            return {**m, "source": "mitarbeiter"}
    # Fallback: User-Doc als synthetischer Mitarbeiter
    if username:
        u = await db.users.find_one({"username": username}, {"_id": 0, "password": 0})
        if u:
            return {
                "id": f"user:{username}",
                "vorname": username,
                "nachname": "",
                "email": u.get("email", ""),
                "role": u.get("role", ""),
                "source": "user",
            }
    return {}


async def _get_mitarbeiter_for_user(user) -> Optional[dict]:
    """Compat-Wrapper für bestehende Aufrufer — liefert nur, wenn jemand auflösbar ist."""
    r = await _resolve_user_to_recipient(user)
    return r if r.get("id") else None


def _username(user) -> str:
    return (getattr(user, "username", None) or (user or {}).get("username", "") or "").strip()


def _mitarbeiter_label(m: dict) -> str:
    v = (m or {}).get('vorname', '') or ''
    n = (m or {}).get('nachname', '') or ''
    return f"{v} {n}".strip()


async def _kunde_label(kunde_id: str) -> str:
    if not kunde_id:
        return ""
    k = await db.module_kunden.find_one({"id": kunde_id}, {"_id": 0, "vorname": 1, "nachname": 1, "firma": 1, "name": 1})
    if not k:
        return ""
    return (
        k.get("firma")
        or " ".join([s for s in [k.get("vorname", ""), k.get("nachname", "")] if s]).strip()
        or k.get("name")
        or ""
    )


class WolkeCreate(BaseModel):
    type: str
    empfaenger_id: str
    kunde_id: Optional[str] = ""
    text: str
    # Zukunftsvorbereitung Spracheingabe (noch kein Code): "text" | "sprache"
    eingabe_quelle: Optional[str] = "text"


class WolkeAntwort(BaseModel):
    text: str
    eingabe_quelle: Optional[str] = "text"


@router.post("")
async def create_wolke(body: WolkeCreate, user=Depends(get_current_user)):
    if body.type not in VALID_TYPES:
        raise HTTPException(400, f"type muss einer von {VALID_TYPES} sein")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "text darf nicht leer sein")
    if not body.empfaenger_id:
        raise HTTPException(400, "empfaenger_id fehlt")

    empf = None
    if body.empfaenger_id.startswith("user:"):
        uname = body.empfaenger_id[5:]
        u = await db.users.find_one({"username": uname}, {"_id": 0, "password": 0})
        if u:
            empf = {
                "id": f"user:{uname}",
                "vorname": uname,
                "nachname": "",
                "email": u.get("email", ""),
                "source": "user",
            }
    else:
        empf = await db.mitarbeiter.find_one({"id": body.empfaenger_id}, {"_id": 0})
    if not empf:
        raise HTTPException(404, "Empfänger nicht gefunden")

    absender = await _get_mitarbeiter_for_user(user)
    absender_id = (absender or {}).get("id", "")
    absender_name = _mitarbeiter_label(absender or {}) or _username(user) or "Unbekannt"

    kunde_id = (body.kunde_id or "").strip()
    kunde_label = await _kunde_label(kunde_id) if kunde_id else ""

    # Memos gelten sofort als 'erledigt' (Counter zählt sie nicht).
    status = "erledigt" if body.type == "memo" else "offen"
    now = _now_iso()
    # Empfaenger-Username fuer Push-Versand auflösen.
    # - empfaenger_id "user:<name>" -> name direkt nutzen
    # - sonst Mitarbeiter-Doc -> per email auf db.users mappen
    empf_username = ""
    if empf.get("source") == "user":
        empf_username = (empf.get("vorname") or "").strip()  # bei user-source steht username in vorname
    else:
        empf_email = (empf.get("email") or "").strip()
        if empf_email:
            u = await db.users.find_one({"email": empf_email}, {"_id": 0, "username": 1})
            if u:
                empf_username = (u.get("username") or "").strip()

    # Wiederholungs-Konfiguration: nur fuer 'aufgabe', nicht fuer 'memo'.
    naechster_retry_at = None
    if status == "offen":
        naechster_retry_at = (datetime.now(timezone.utc) + timedelta(minutes=WOLKE_RETRY_INTERVALL_MIN)).isoformat()

    doc = {
        "id": str(uuid4()),
        "type": body.type,
        "absender_id": absender_id,
        "absender_name": absender_name,
        "empfaenger_id": empf.get("id", ""),
        "empfaenger_name": _mitarbeiter_label(empf),
        "empfaenger_username": empf_username,
        "kunde_id": kunde_id,
        "kunde_label": kunde_label,
        "text": text,
        "status": status,
        "created_at": now,
        "created_by_user": _username(user),
        "erledigt_am": now if status == "erledigt" else None,
        "erledigt_von": absender_id if status == "erledigt" else None,
        # Empfangs-/Lese-Bestätigung (3 Stufen: gesendet=created_at, empfangen=erhalten_am, gelesen=gelesen_am)
        "erhalten_am": None,
        "erhalten_von": "",
        "erhalten_via": "",
        "gelesen_am": None,
        "gelesen_von": "",
        # Soft-Delete: pro Person ausblenden (Liste von User/Mitarbeiter-IDs)
        "ausgeblendet_fuer": [],
        # Antworten: Verknuepfung zur Original-Nachricht
        "antwort_auf_id": None,
        # Zukunftsvorbereitung Spracheingabe (noch kein Code)
        "eingabe_quelle": (body.eingabe_quelle or "text"),
        "transkript_roh": None,
        # Retry-Felder (nur fuer 'aufgabe' aktiv)
        "retry_count": 0,
        "max_versuche": WOLKE_MAX_VERSUCHE,
        "retry_intervall_min": WOLKE_RETRY_INTERVALL_MIN,
        "naechster_retry_at": naechster_retry_at,
    }
    await db.module_wolke.insert_one({**doc})  # avoid _id mutation in response

    # Push-Benachrichtigung an Empfänger (nur bei 'aufgabe' — Memos sind passiv).
    if status == "offen" and empf_username:
        try:
            from routes.push import send_push_to_user
            push_body = f"{absender_name}: {text[:120]}"
            sent = await send_push_to_user(
                username=empf_username,
                title="📬 Neue Wolke-Aufgabe",
                body=push_body,
                url="/module/wolke?tab=erhalten",
                entity_type="wolke",
                entity_id=doc["id"],
            )
            await db.module_wolke.update_one(
                {"id": doc["id"]},
                {"$set": {"retry_count": 1, "letzter_push_at": now, "letzter_push_ok": sent > 0}},
            )
            doc["retry_count"] = 1
            doc["letzter_push_at"] = now
            doc["letzter_push_ok"] = sent > 0
        except Exception as e:
            from database import logger
            logger.warning(f"Wolke create: Push fehlgeschlagen: {e}")

    return doc


def _normalize_status_filter(status: str) -> dict:
    if not status or status == "all":
        return {}
    if status not in VALID_STATUS:
        raise HTTPException(400, f"status muss einer von {VALID_STATUS} oder 'all' sein")
    return {"status": status}


async def _auto_archive_old():
    """Lazy-Archivierung: erledigte UND gelesene Nachrichten aelter als ARCHIV_TAGE
    werden auf Status 'archiviert' gesetzt (nicht geloescht). Idempotent, konstanter Aufwand."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ARCHIV_TAGE)).isoformat()
    await db.module_wolke.update_many(
        {"status": "erledigt", "gelesen_am": {"$ne": None}, "created_at": {"$lt": cutoff}},
        {"$set": {"status": "archiviert", "archiviert_am": _now_iso()}},
    )


@router.get("/erhalten")
async def list_erhalten(status: str = "all", limit: int = 10, skip: int = 0, user=Depends(get_current_user)):
    me = await _get_mitarbeiter_for_user(user)
    if not me:
        return []
    await _auto_archive_old()
    me_id = me.get("id", "")
    q = {"empfaenger_id": me_id, "ausgeblendet_fuer": {"$ne": me_id}}
    if status and status != "all":
        q.update(_normalize_status_filter(status))
    else:
        q["status"] = {"$ne": "archiviert"}
    docs = await db.module_wolke.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return docs


@router.get("/gesendet")
async def list_gesendet(status: str = "all", limit: int = 10, skip: int = 0, user=Depends(get_current_user)):
    me = await _get_mitarbeiter_for_user(user)
    if not me:
        return []
    me_id = me.get("id", "")
    q = {"absender_id": me_id, "ausgeblendet_fuer": {"$ne": me_id}}
    if status and status != "all":
        q.update(_normalize_status_filter(status))
    else:
        q["status"] = {"$ne": "archiviert"}
    docs = await db.module_wolke.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return docs


@router.get("/archiv")
async def list_archiv(limit: int = 10, skip: int = 0, user=Depends(get_current_user)):
    me = await _get_mitarbeiter_for_user(user)
    if not me:
        return []
    me_id = me.get("id", "")
    q = {
        "status": "archiviert",
        "ausgeblendet_fuer": {"$ne": me_id},
        "$or": [{"empfaenger_id": me_id}, {"absender_id": me_id}],
    }
    docs = await db.module_wolke.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return docs


@router.get("/count-offen")
async def count_offen(user=Depends(get_current_user)):
    me = await _get_mitarbeiter_for_user(user)
    if not me:
        return {"count": 0}
    n = await db.module_wolke.count_documents({
        "empfaenger_id": me.get("id", ""),
        "type": "aufgabe",
        "status": "offen",
    })
    return {"count": n}


@router.patch("/{wolke_id}/erhalten")
async def mark_erhalten(wolke_id: str, user=Depends(get_current_user)):
    """Empfaenger bestaetigt: Push/Wolke ist angekommen. Stoppt den Retry-Loop.
    Loescht 'erledigt' NICHT — Erledigt ist ein separater Workflow-Schritt."""
    doc = await db.module_wolke.find_one({"id": wolke_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Wolke nicht gefunden")
    me = await _get_mitarbeiter_for_user(user)
    is_admin = (getattr(user, "role", "") or (user or {}).get("role", "")) == "admin"
    if not is_admin and (not me or me.get("id") != doc.get("empfaenger_id")):
        raise HTTPException(403, "Nur der Empfänger oder ein Admin darf 'erhalten' bestaetigen")
    if doc.get("erhalten_am"):
        return doc  # idempotent
    now = _now_iso()
    erh_von = (me or {}).get("id", "") or _username(user) or "admin"
    await db.module_wolke.update_one(
        {"id": wolke_id},
        {"$set": {"erhalten_am": now, "erhalten_von": erh_von, "erhalten_via": "tipp"}},
    )
    doc["erhalten_am"] = now
    doc["erhalten_von"] = erh_von
    doc["erhalten_via"] = "tipp"
    return doc


@router.patch("/{wolke_id}/erledigt")
async def mark_erledigt(wolke_id: str, user=Depends(get_current_user)):
    doc = await db.module_wolke.find_one({"id": wolke_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Wolke nicht gefunden")
    me = await _get_mitarbeiter_for_user(user)
    is_admin = (getattr(user, "role", "") or (user or {}).get("role", "")) == "admin"
    if not is_admin and (not me or me.get("id") != doc.get("empfaenger_id")):
        raise HTTPException(403, "Nur der Empfänger oder ein Admin darf erledigen")
    if doc.get("status") == "erledigt":
        return doc
    now = _now_iso()
    await db.module_wolke.update_one(
        {"id": wolke_id},
        {"$set": {
            "status": "erledigt",
            "erledigt_am": now,
            "erledigt_von": (me or {}).get("id", "") or "admin",
        }},
    )
    doc["status"] = "erledigt"
    doc["erledigt_am"] = now
    doc["erledigt_von"] = (me or {}).get("id", "") or "admin"
    return doc


@router.patch("/{wolke_id}/gelesen")
async def mark_gelesen(wolke_id: str, user=Depends(get_current_user)):
    """Empfaenger hat die Nachricht gelesen (3. Bestaetigungsstufe, blau).
    Impliziert 'erhalten', falls noch nicht gesetzt."""
    doc = await db.module_wolke.find_one({"id": wolke_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Wolke nicht gefunden")
    me = await _get_mitarbeiter_for_user(user)
    is_admin = (getattr(user, "role", "") or (user or {}).get("role", "")) == "admin"
    if not is_admin and (not me or me.get("id") != doc.get("empfaenger_id")):
        raise HTTPException(403, "Nur der Empfänger oder ein Admin darf 'gelesen' bestaetigen")
    if doc.get("gelesen_am"):
        return doc  # idempotent
    now = _now_iso()
    von = (me or {}).get("id", "") or _username(user) or "admin"
    sets = {"gelesen_am": now, "gelesen_von": von}
    if not doc.get("erhalten_am"):
        sets.update({"erhalten_am": now, "erhalten_von": von, "erhalten_via": "gelesen"})
    await db.module_wolke.update_one({"id": wolke_id}, {"$set": sets})
    doc.update(sets)
    return doc


@router.post("/{wolke_id}/antwort")
async def antwort_wolke(wolke_id: str, body: WolkeAntwort, user=Depends(get_current_user)):
    """Antwort auf eine empfangene Nachricht: erzeugt eine verknuepfte Wolke
    (antwort_auf_id) an den Original-Absender."""
    orig = await db.module_wolke.find_one({"id": wolke_id}, {"_id": 0})
    if not orig:
        raise HTTPException(404, "Original-Nachricht nicht gefunden")
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "text darf nicht leer sein")

    absender = await _get_mitarbeiter_for_user(user)
    absender_id = (absender or {}).get("id", "")
    absender_name = _mitarbeiter_label(absender or {}) or _username(user) or "Unbekannt"

    empf_id = orig.get("absender_id", "")
    empf_name = orig.get("absender_name", "")
    if not empf_id:
        raise HTTPException(400, "Original hat keinen Absender zum Antworten")

    # Empfaenger-Username fuer Push aufloesen
    empf_username = ""
    if empf_id.startswith("user:"):
        empf_username = empf_id[5:]
    else:
        m = await db.mitarbeiter.find_one({"id": empf_id}, {"_id": 0, "email": 1})
        if m and m.get("email"):
            u = await db.users.find_one({"email": m["email"]}, {"_id": 0, "username": 1})
            if u:
                empf_username = (u.get("username") or "").strip()

    now = _now_iso()
    naechster_retry_at = (datetime.now(timezone.utc) + timedelta(minutes=WOLKE_RETRY_INTERVALL_MIN)).isoformat()
    doc = {
        "id": str(uuid4()),
        "type": "aufgabe",
        "absender_id": absender_id,
        "absender_name": absender_name,
        "empfaenger_id": empf_id,
        "empfaenger_name": empf_name,
        "empfaenger_username": empf_username,
        "kunde_id": orig.get("kunde_id", ""),
        "kunde_label": orig.get("kunde_label", ""),
        "text": text,
        "status": "offen",
        "created_at": now,
        "created_by_user": _username(user),
        "erledigt_am": None,
        "erledigt_von": None,
        "erhalten_am": None,
        "erhalten_von": "",
        "erhalten_via": "",
        "gelesen_am": None,
        "gelesen_von": "",
        "ausgeblendet_fuer": [],
        "antwort_auf_id": wolke_id,
        "eingabe_quelle": (body.eingabe_quelle or "text"),
        "transkript_roh": None,
        "retry_count": 0,
        "max_versuche": WOLKE_MAX_VERSUCHE,
        "retry_intervall_min": WOLKE_RETRY_INTERVALL_MIN,
        "naechster_retry_at": naechster_retry_at,
    }
    await db.module_wolke.insert_one({**doc})

    if empf_username:
        try:
            from routes.push import send_push_to_user
            await send_push_to_user(
                username=empf_username,
                title="💬 Antwort in der Wolke",
                body=f"{absender_name}: {text[:120]}",
                url="/module/wolke?tab=erhalten",
                entity_type="wolke",
                entity_id=doc["id"],
            )
        except Exception as e:
            from database import logger
            logger.warning(f"Wolke antwort: Push fehlgeschlagen: {e}")

    return doc


@router.delete("/{wolke_id}")
async def delete_wolke(wolke_id: str, user=Depends(get_current_user)):
    """Soft-Delete: blendet die Nachricht NUR fuer die loeschende Person aus
    (Absender oder Empfaenger). Der gemeinsame Datensatz bleibt erhalten."""
    doc = await db.module_wolke.find_one({"id": wolke_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Wolke nicht gefunden")
    me = await _get_mitarbeiter_for_user(user)
    is_admin = (getattr(user, "role", "") or (user or {}).get("role", "")) == "admin"
    me_id = (me or {}).get("id", "") or _username(user)
    if not is_admin and me_id not in (doc.get("absender_id"), doc.get("empfaenger_id")):
        raise HTTPException(403, "Nur Absender oder Empfänger darf ausblenden")
    await db.module_wolke.update_one({"id": wolke_id}, {"$addToSet": {"ausgeblendet_fuer": me_id}})
    return {"ok": True, "soft": True}


@router.get("/mitarbeiter")
async def list_mitarbeiter(user=Depends(get_current_user)):
    """Empfänger-Auswahl: aktive Mitarbeiter + Admin-User (Variante b).
    Admin-User bekommen eine synthetische id 'user:<username>'.
    Aktueller User wird aus der Liste rausgefiltert (kann sich nicht selbst Wolken senden).
    """
    me_username = (getattr(user, "username", "") or (user or {}).get("username", "") or "").strip()
    out = []

    # 1) Mitarbeiter
    cursor = db.mitarbeiter.find(
        {"$or": [{"status": "aktiv"}, {"status": {"$exists": False}}, {"status": ""}]},
        {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "email": 1, "position": 1},
    )
    async for m in cursor:
        out.append({
            "id": m.get("id", ""),
            "name": _mitarbeiter_label(m),
            "email": m.get("email", ""),
            "position": m.get("position", ""),
            "source": "mitarbeiter",
        })

    # 2) Admin-User (alle, auch wenn ein Mitarbeiter mit derselben Email existiert)
    admin_cursor = db.users.find(
        {"role": "admin"},
        {"_id": 0, "username": 1, "email": 1},
    )
    async for u in admin_cursor:
        uname = (u.get("username") or "").strip()
        if not uname:
            continue
        out.append({
            "id": f"user:{uname}",
            "name": uname,
            "email": u.get("email", ""),
            "position": "Admin",
            "source": "user",
        })

    # Aktuellen User aus eigener Liste rausfiltern (Username-Match oder User-id-Match)
    out = [
        r for r in out
        if r.get("name") != me_username and r.get("id") != f"user:{me_username}"
    ]
    out.sort(key=lambda x: x["name"].lower())
    return out
