"""
module_textkorrektur — KI-Rechtschreib- und Grammatik-Korrektur.

Module-First:
- Eigene Route /api/module-textkorrektur/check
- Keine eigene Collection (stateless)
- Nutzt Emergent-LLM-Key + GPT-5.2 (gleiche Infra wie routes/ai.py)
"""
import json
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
    # Optionaler Dokument-Kontext, damit die KI das Schreiben als Einheit versteht
    # (z. B. "Angebot für Kunde Müller, 3 Positionen, Gesamt 1.234,00 €").
    kontext_info: Optional[str] = None


class FieldResult(BaseModel):
    id: str
    label: str
    original: str
    corrected: str
    changed: bool


class DocumentCheckResponse(BaseModel):
    results: List[FieldResult]


DOC_SYSTEM_PROMPT = (
    "Du bist ein professioneller deutscher Lektor für Geschäftskorrespondenz "
    "einer Tischlerei.\n\n"
    "Du erhältst MEHRERE Textfelder EINES zusammenhängenden Dokuments "
    "(z. B. ein Angebot, einen Auftrag oder eine Rechnung). Betrachte alle "
    "Felder als Einheit: gleiche Anrede, gleicher Stil, einheitliche "
    "Fachbegriffe über das ganze Dokument hinweg.\n\n"
    "Aufgabe: Korrigiere ausschließlich Rechtschreibung, Zeichensetzung und "
    "Grammatik jedes Feldes.\n\n"
    "Strikte Regeln:\n"
    "- Behalte Stil, Tonalität und Anrede 1:1 bei.\n"
    "- Verändere KEINE Eigennamen, Firmennamen, Marken, Produktnamen oder Adressen.\n"
    "- Verändere KEINE Zahlen, Beträge, Datumsangaben, IBAN, Telefonnummern.\n"
    "- Behalte alle Zeilenumbrüche und Absätze exakt bei.\n"
    "- Füge KEINE neuen Sätze, Erklärungen oder Anführungszeichen hinzu.\n"
    "- Ist ein Feld bereits korrekt, gib es unverändert zurück.\n"
    "- Halte Fachbegriffe über alle Felder hinweg einheitlich.\n\n"
    "Antworte AUSSCHLIESSLICH mit gültigem JSON in genau diesem Format:\n"
    '{"results": [{"id": "<feld-id>", "corrected": "<korrigierter text>"}]}\n'
    "Kein Markdown, keine Code-Fences, keine Erklärungen."
)


@router.post("/check-document", response_model=DocumentCheckResponse)
async def check_document(payload: DocumentCheckPayload, user=Depends(get_current_user)):
    """Prüft alle Textfelder eines Dokuments KONTEXTBEWUSST in EINEM KI-Aufruf.

    Die KI sieht das gesamte Dokument (inkl. optionalem Kontext) auf einmal und
    korrigiert alle Felder einheitlich. Das ersetzt die frühere Feld-für-Feld-Prüfung.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY nicht konfiguriert")
    if not payload.fields:
        return DocumentCheckResponse(results=[])

    # Nur Felder mit Inhalt an die KI geben; leere/zu lange werden 1:1 durchgereicht.
    to_check = [f for f in payload.fields if (f.text or "").strip() and len(f.text) <= 8000]

    corrected_map: dict[str, str] = {}
    if to_check:
        lines: List[str] = []
        if payload.kontext_info:
            lines.append(f"Dokument-Kontext: {payload.kontext_info}\n")
        lines.append("Zu prüfende Felder:")
        for f in to_check:
            lines.append(f"--- Feld-ID: {f.id} ({f.label}) ---")
            lines.append(f.text)
        user_text = "\n".join(lines)

        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"textkorrektur-doc-{uuid.uuid4()}",
                system_message=DOC_SYSTEM_PROMPT,
            ).with_model("openai", "gpt-5.2")
            raw = (await chat.send_message(UserMessage(text=user_text)) or "").strip()
        except Exception as e:
            logger.error(f"Kontextbewusste Dokumentprüfung fehlgeschlagen: {e}")
            raise HTTPException(500, "KI-Korrektur fehlgeschlagen")  # noqa: B904

        # Robustes JSON-Extrakt: evtl. Code-Fences/Begleittext der KI tolerieren.
        try:
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1:
                parsed = json.loads(raw[start:end + 1])
                for item in parsed.get("results", []):
                    fid = item.get("id")
                    corr = item.get("corrected")
                    if fid is not None and isinstance(corr, str):
                        corrected_map[fid] = corr.strip()
        except Exception as e:
            logger.warning(f"Antwort der KI nicht als JSON lesbar: {e}")

    results = []
    for f in payload.fields:
        corrected = corrected_map.get(f.id) or f.text
        results.append(FieldResult(
            id=f.id,
            label=f.label,
            original=f.text,
            corrected=corrected,
            changed=(corrected != f.text),
        ))
    return DocumentCheckResponse(results=results)
