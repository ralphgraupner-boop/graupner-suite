from fastapi import APIRouter, HTTPException, UploadFile, File
from io import BytesIO
import uuid
from models import AIQuoteRequest
from database import db, EMERGENT_LLM_KEY, logger
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

router = APIRouter()


@router.post("/speech-to-text")
async def speech_to_text(audio: UploadFile = File(...)):
    """Sprache zu Text mit OpenAI Whisper"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="API Key nicht konfiguriert")

    try:
        stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)

        audio_content = await audio.read()
        audio_file = BytesIO(audio_content)
        audio_file.name = audio.filename or "audio.webm"

        response = await stt.transcribe(
            file=audio_file,
            model="whisper-1",
            language="de",
            response_format="json"
        )

        return {"text": response.text}
    except Exception as e:
        logger.error(f"Speech-to-text error: {e}")
        raise HTTPException(status_code=500, detail=f"Fehler bei Spracherkennung: {str(e)}")


@router.post("/ai/generate-quote")
async def generate_quote_with_ai(request: AIQuoteRequest):
    """KI-gestützte Angebotserstellung aus Sprachtranskript"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="API Key nicht konfiguriert")

    customer = await db.customers.find_one({"id": request.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    articles = await db.articles.find({}, {"_id": 0}).to_list(100)
    articles_context = ""
    if articles:
        articles_context = "\n\nVerfügbare Artikel (Material):\n"
        for a in articles:
            articles_context += f"- {a['name']}: {a['price_net']}€/{a['unit']} - {a.get('description', '')}\n"

    services = await db.services.find({}, {"_id": 0}).to_list(100)
    services_context = ""
    if services:
        services_context = "\n\nVerfügbare Leistungen (Arbeit):\n"
        for s in services:
            services_context += f"- {s['name']}: {s['price_net']}€/{s['unit']} - {s.get('description', '')}\n"

    system_message = f"""Du bist ein Assistent für eine Tischlerei. Erstelle aus der Sprachbeschreibung ein strukturiertes Angebot.

Kundeninformation:
- Name: {customer['name']}
- Adresse: {customer.get('address', 'Nicht angegeben')}
- Notizen: {customer.get('notes', '')}
{articles_context}{services_context}

Antworte NUR mit einem JSON-Objekt im folgenden Format (keine Erklärungen):
{{
    "positions": [
        {{"pos_nr": 1, "description": "Beschreibung der Arbeit", "quantity": 1, "unit": "Stück", "price_net": 100.00}}
    ],
    "notes": "Zusätzliche Anmerkungen zum Angebot"
}}

Wichtig:
- Schätze realistische Preise für Tischlerarbeiten
- Verwende deutsche Beschreibungen
- Trenne Material (Artikel) und Arbeitsleistung (Leistungen) in separate Positionen
- Preise sind Nettopreise in Euro"""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"quote-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-5.2")

        user_message = UserMessage(text=f"Erstelle ein Angebot basierend auf dieser Beschreibung:\n\n{request.transcribed_text}")

        response = await chat.send_message(user_message)

        import json
        import re

        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            quote_data = json.loads(json_match.group())
        else:
            raise ValueError("Keine gültige JSON-Antwort von KI")

        return {
            "positions": quote_data.get("positions", []),
            "notes": quote_data.get("notes", ""),
            "vat_rate": request.vat_rate
        }
    except Exception as e:
        logger.error(f"AI quote generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Fehler bei KI-Angebotserstellung: {str(e)}")
