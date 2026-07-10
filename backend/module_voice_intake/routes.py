"""Voice-Intake — Backend-Routen.

Whisper-Transkription + GPT-Strukturierung (deutsch). Beides ueber den
Emergent Universal Key.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from auth import get_current_user
from database import db, logger
import os
import io
import json
from datetime import datetime, timezone
from typing import Optional

router = APIRouter(prefix="/voice-intake", tags=["voice-intake"])


def _key() -> str:
    k = os.getenv("OPENAI_API_KEY")
    if not k:
        raise HTTPException(500, "OPENAI_API_KEY fehlt im Backend")
    return k


async def _transcribe_bytes(data: bytes, filename: str, language: str = "de") -> str:
    """Audio-Bytes → Plain-Transkript via Whisper."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=_key())
    # Buffer, damit der Client filename+content_type sauber bekommt
    buf = io.BytesIO(data)
    buf.name = filename or "aufnahme.webm"
    try:
        # Prompt mit Tischler-Vokabular für bessere Erkennung von Fachbegriffen
        prompt_de = (
            "Tischlerei-Besichtigung. Begriffe: Hebeschiebetür, HSK, Kipptür, "
            "Drehkipp, Laufwagen, Getriebe, Beschlag, Hautau, Roto, Maco, Siegenia, "
            "GU, Gretsch-Unitas, Kunststoff, Holz/Alu, Aluminium, Lichtraum, "
            "Aufmass, Rolllaeden, Rolladen, Innentür, Eingangstür, Fenster."
        )
        resp = await client.audio.transcriptions.create(
            file=buf,
            model="whisper-1",
            response_format="json",
            language=language,
            prompt=prompt_de,
            temperature=0.0,
        )
        return (getattr(resp, "text", "") or "").strip()
    except Exception as exc:
        logger.error(f"Whisper-Fehler: {exc}")
        raise HTTPException(500, f"Transkription fehlgeschlagen: {exc}")


async def _structure_text(text: str) -> dict:
    """Transkript → strukturierte Felder via GPT (deutsch)."""
    from openai import AsyncOpenAI
    if not text or not text.strip():
        return {}
    system = (
        "Du extrahierst aus deutschen Tischler-Besichtigungsnotizen strukturierte "
        "Daten. Antworte AUSSCHLIESSLICH mit JSON, keine Erklärungen.\n\n"
        "Felder (alle optional, nur ausfüllen wenn klar erwähnt):\n"
        "- reparaturgruppe (z.B. 'HSK', 'Fenster', 'Eingangstür', 'Innentür', 'Rollläden')\n"
        "- material ('Kunststoff', 'Holz', 'Aluminium', 'Holz/Alu')\n"
        "- hersteller (Hautau, Roto, Maco, Siegenia, GU, …)\n"
        "- alter_jahre (ganze Zahl, Schätzung)\n"
        "- schaden (kurze, klare Beschreibung)\n"
        "- beschreibung (1–2 Sätze, Profi-Sprache, ohne Floskeln)\n"
        "- farbe / abmessungen / sonstiges (frei, optional)"
    )
    client = AsyncOpenAI(api_key=_key())
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            temperature=0.0,
        )
        raw = (resp.choices[0].message.content or "").strip()
        raw = (raw or "").strip()
        # GPT liefert oft Markdown-Codefence — entfernen
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
            if raw.lower().startswith("json"):
                raw = raw[4:].lstrip()
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return {}
        return parsed
    except Exception as exc:
        logger.warning(f"Struktur-Extraktion fehlgeschlagen: {exc}")
        return {"_warn": "Strukturierung fehlgeschlagen — Roh-Transkript wird trotzdem geliefert."}


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), language: str = Form("de"), user=Depends(get_current_user)):
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Leere Datei")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Datei zu groß (max 25 MB)")
    text = await _transcribe_bytes(data, audio.filename or "aufnahme.webm", language)
    return {"text": text, "duration_bytes": len(data)}


@router.post("/structure")
async def structure(payload: dict, user=Depends(get_current_user)):
    text = (payload or {}).get("text") or ""
    return {"text": text, "fields": await _structure_text(text)}


@router.post("/transcribe-and-structure")
async def transcribe_and_structure(audio: UploadFile = File(...), language: str = Form("de"), user=Depends(get_current_user)):
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Leere Datei")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Datei zu groß (max 25 MB)")
    text = await _transcribe_bytes(data, audio.filename or "aufnahme.webm", language)
    fields = await _structure_text(text) if text else {}
    return {"text": text, "fields": fields}


# ── Public-Variante für Mitarbeiter ohne Login ──
# Nutzt module_kundenlink-Token als Authentifizierung. Kein get_current_user.
@router.post("/transcribe-public/{token}")
async def transcribe_public(token: str, audio: UploadFile = File(...), language: str = Form("de")):
    link = await db.module_kundenlink.find_one({"token": token, "revoked": {"$ne": True}}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Ungültiger oder widerrufener Link")
    try:
        exp = datetime.fromisoformat(link.get("expires_at", ""))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(410, "Link ist abgelaufen")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(410, "Link ist ungültig")  # noqa: B904
    data = await audio.read()
    if not data:
        raise HTTPException(400, "Leere Datei")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Datei zu groß (max 25 MB)")
    text = await _transcribe_bytes(data, audio.filename or "aufnahme.webm", language)
    fields = await _structure_text(text) if text else {}
    # Beitrag-Zähler hochsetzen, damit Ralph im Cockpit sieht, dass der
    # Mitarbeiter aktiv etwas eingesprochen hat.
    await db.module_kundenlink.update_one(
        {"id": link["id"]},
        {"$inc": {"contribution_count": 1}, "$set": {"last_contribution_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"text": text, "fields": fields}
