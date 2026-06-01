"""KI-Chat fuer den Assistent — GPT-5.2 via Emergent LLM Key.

Liefert strukturierte JSON-Antwort, die in module_assistent.ai_tools.execute_tool
weiterverarbeitet wird.
"""
from __future__ import annotations
import os
import json
from typing import Optional, Dict, Any

from fastapi import HTTPException
from database import logger
from .ai_tools import system_prompt_de


def _emergent_key() -> str:
    k = os.getenv("EMERGENT_LLM_KEY")
    if not k:
        raise HTTPException(500, "EMERGENT_LLM_KEY fehlt im Backend")
    return k


def _strip_codefence(raw: str) -> str:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        if raw.lower().startswith("json"):
            raw = raw[4:].lstrip()
    return raw


async def gpt_intent(text: str, session_id: str) -> Dict[str, Any]:
    """Schickt Ralphs Eingabe an GPT-5.2 und gibt {tool, args, antwort} zurueck."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    if not text or not text.strip():
        return {"tool": None, "args": {}, "antwort": "Sag mir was — ich hoere dir zu, Ralph."}

    chat = (
        LlmChat(api_key=_emergent_key(), session_id=session_id, system_message=system_prompt_de())
        .with_model("openai", "gpt-5.2")
    )
    try:
        raw = await chat.send_message(UserMessage(text=text.strip()))
        clean = _strip_codefence(raw)
        parsed = json.loads(clean)
        if not isinstance(parsed, dict):
            raise ValueError("Antwort ist kein JSON-Objekt")
        # Defaults absichern
        parsed.setdefault("tool", None)
        parsed.setdefault("args", {})
        parsed.setdefault("antwort", "Ist erledigt, Ralph.")
        return parsed
    except json.JSONDecodeError as exc:
        logger.warning(f"GPT-Intent: kein gueltiges JSON ({exc}); raw={raw[:200] if raw else ''}")
        return {
            "tool": None,
            "args": {},
            "antwort": (
                "Ich hab dich gehoert, aber konnte das nicht eindeutig zuordnen, Ralph. "
                "Magst du es nochmal etwas konkreter sagen? (z.B. 'Termin morgen 10 Uhr mit ...')"
            ),
        }
    except Exception as exc:
        logger.error(f"GPT-Intent fehlgeschlagen: {exc}")
        raise HTTPException(500, f"KI-Aufruf fehlgeschlagen: {exc}")
