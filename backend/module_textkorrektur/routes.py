"""
module_textkorrektur — KI-Rechtschreib- und Grammatik-Korrektur.

Module-First:
- Eigene Route /api/module-textkorrektur/check
- Keine eigene Collection (stateless)
- Nutzt Emergent-LLM-Key + GPT-5.2 (gleiche Infra wie routes/ai.py)
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal, Optional, List

from database import EMERGENT_LLM_KEY, logger
from routes.auth import get_current_user
from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter()


# ==================== Models ====================

class CheckPayload(BaseModel):
    text: str
    kontext: Optional[Literal["betreff", "vortext", "schlusstext", "allgemein"]] = "allgemein"


class CheckResponse(BaseModel):
    original: str
    corrected: str
    changed: bool


# ==================== Prompt ====================

SYSTEM_PROMPT = (
    "Du bist ein professioneller deutscher Lektor für Geschäftskorrespondenz "
    "einer Tischlerei.\n\n"
    "Aufgabe: Korrigiere ausschließlich Rechtschreibung, Zeichensetzung und "
    "Grammatik des folgenden Textes.\n\n"
    "Strikte Regeln:\n"
    "- Behalte Stil, Tonalität und Anrede 1:1 bei.\n"
    "- Verändere KEINE Eigennamen, Firmennamen, Marken, Produktnamen oder Adressen.\n"
    "- Verändere KEINE Zahlen, Beträge, Datumsangaben, IBAN, Telefonnummern.\n"
    "- Behalte alle Zeilenumbrüche und Absätze exakt bei.\n"
    "- Füge KEINE neuen Sätze, Erklärungen oder Anführungszeichen hinzu.\n"
    "- Wenn der Text bereits korrekt ist, gib ihn unverändert zurück.\n"
    "- Antworte AUSSCHLIESSLICH mit dem korrigierten Text — kein Vorwort, "
    "keine Erklärungen, kein Markdown, keine Kommentare."
)


# ==================== Endpoint ====================

@router.post("/check", response_model=CheckResponse)
async def check_text(payload: CheckPayload, user=Depends(get_current_user)):
    """Korrigiert Rechtschreibung und Grammatik via GPT-5.2 (Emergent LLM Key)."""
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(400, "Text ist leer")
    if len(text) > 8000:
        raise HTTPException(400, "Text zu lang (max. 8000 Zeichen)")
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY nicht konfiguriert")

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"textkorrektur-{uuid.uuid4()}",
            system_message=SYSTEM_PROMPT,
        ).with_model("openai", "gpt-5.2")

        user_message = UserMessage(text=text)
        corrected = (await chat.send_message(user_message) or "").strip()

        # Nachpolitur: KI hat manchmal Anführungszeichen außen herum
        if (corrected.startswith('"') and corrected.endswith('"')) or (
            corrected.startswith("„") and corrected.endswith("“")
        ):
            corrected = corrected[1:-1].strip()

        if not corrected:
            corrected = text

        return CheckResponse(
            original=payload.text,
            corrected=corrected,
            changed=(corrected != payload.text),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Textkorrektur fehlgeschlagen ({payload.kontext}): {e}")
        raise HTTPException(500, f"KI-Korrektur fehlgeschlagen: {e}")


# ==================== Batch (Dokument prüfen) ====================

class DocumentField(BaseModel):
    id: str
    label: str
    text: str
    kontext: Optional[Literal["betreff", "vortext", "schlusstext", "allgemein"]] = "allgemein"


class DocumentCheckPayload(BaseModel):
    fields: List[DocumentField]


class FieldResult(BaseModel):
    id: str
    label: str
    original: str
    corrected: str
    changed: bool


class DocumentCheckResponse(BaseModel):
    results: List[FieldResult]


async def _correct_single(text: str) -> str:
    """Ein Lektorat-Call für einen Text. Gibt korrigierten Text zurück."""
    if not text.strip():
        return text
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"textkorrektur-{uuid.uuid4()}",
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-5.2")
    corrected = (await chat.send_message(UserMessage(text=text)) or "").strip()
    if (corrected.startswith('"') and corrected.endswith('"')) or (
        corrected.startswith("„") and corrected.endswith("“")
    ):
        corrected = corrected[1:-1].strip()
    return corrected or text


@router.post("/check-document", response_model=DocumentCheckResponse)
async def check_document(payload: DocumentCheckPayload, user=Depends(get_current_user)):
    """Prüft alle Textfelder eines Dokuments parallel und gibt Korrekturen zurück."""
    import asyncio
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY nicht konfiguriert")
    if not payload.fields:
        return DocumentCheckResponse(results=[])
    # Nur Felder mit Inhalt prüfen — leere Felder werden 1:1 durchgereicht.
    tasks = []
    for f in payload.fields:
        txt = (f.text or "").strip()
        if not txt or len(txt) > 8000:
            tasks.append(None)
        else:
            tasks.append(_correct_single(f.text))

    corrected_list = []
    coros = [t for t in tasks if t is not None]
    try:
        gathered = await asyncio.gather(*coros, return_exceptions=True)
    except Exception as e:
        logger.error(f"Batch-Korrektur fehlgeschlagen: {e}")
        raise HTTPException(500, f"KI-Korrektur fehlgeschlagen: {e}")  # noqa: B904

    gathered_iter = iter(gathered)
    for f, t in zip(payload.fields, tasks):
        if t is None:
            corrected_list.append(f.text)
        else:
            r = next(gathered_iter)
            if isinstance(r, Exception):
                logger.warning(f"Feld {f.id} Korrektur fehlgeschlagen: {r}")
                corrected_list.append(f.text)
            else:
                corrected_list.append(r)

    results = []
    for f, corrected in zip(payload.fields, corrected_list):
        results.append(FieldResult(
            id=f.id,
            label=f.label,
            original=f.text,
            corrected=corrected,
            changed=(corrected != f.text),
        ))
    return DocumentCheckResponse(results=results)
