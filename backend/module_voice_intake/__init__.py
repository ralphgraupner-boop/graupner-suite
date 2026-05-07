"""Modul: module_voice_intake — Sprachaufnahme bei Besichtigung.

Mitarbeiter spricht in das Handy-Mikrofon, das Audio wird per OpenAI Whisper
transkribiert (deutsch) und optional via GPT in strukturierte Felder
zerlegt (Reparaturgruppe, Material, Hersteller, Alter, Schaden,
Beschreibung).

Endpunkte (alle unter /api/voice-intake/*):
  POST /transcribe        — Audio (multipart) → reines Transkript
  POST /structure         — Transkript-Text → strukturierte Felder
  POST /transcribe-and-structure — beides in einem Schritt

Sicherheit: alle Endpunkte setzen Auth voraus, ausser /transcribe-public —
dieser ist nur ueber gueltigen Mitarbeiter-Token (module_kundenlink)
zugaenglich, damit Monteure ohne Login transkribieren koennen.
"""

from .routes import router

__all__ = ["router"]
