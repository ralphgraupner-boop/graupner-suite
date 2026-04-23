"""
Dokumente v2 – Pydantic-Models
Ein einheitliches Dokument-Modell für alle 4 Typen (angebot / auftrag / rechnung / gutschrift).
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime, timezone
from uuid import uuid4


DocType = Literal["angebot", "auftrag", "rechnung", "gutschrift"]

# GoBD-strenge Typen: nach Erstellung nicht mehr loeschbar, unveraenderbare Nummer
STRICT_TYPES: set[str] = {"rechnung", "gutschrift"}


# ============== POSITIONS ==============

class Position(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    position_nr: Optional[str] = None  # z.B. "01", "02.1"
    beschreibung: str = ""
    menge: float = 1.0
    einheit: str = "Stk"
    einzelpreis: float = 0.0
    rabatt_prozent: float = 0.0
    mwst_satz: float = 19.0
    # sonst_35a: Wage-Anteil bei Rechnungen (§35a EStG Steuerermässigung für Handwerkerleistungen)
    lohn_anteil: float = 0.0


# ============== DOKUMENT ==============

class DokumentCreate(BaseModel):
    type: DocType
    kunde_id: Optional[str] = None  # referenziert module_kunden.id (nur lesend)
    kunde_name: str = ""
    kunde_adresse: str = ""
    kunde_email: str = ""
    betreff: str = ""
    vortext: str = ""
    schlusstext: str = ""
    positions: List[Position] = Field(default_factory=list)
    # Referenz auf vorheriges Dokument (z.B. Auftrag -> Angebot, Rechnung -> Auftrag)
    parent_id: Optional[str] = None


class DokumentConvert(BaseModel):
    target_type: DocType


class DokumentUpdate(BaseModel):
    kunde_id: Optional[str] = None
    kunde_name: Optional[str] = None
    kunde_adresse: Optional[str] = None
    kunde_email: Optional[str] = None
    betreff: Optional[str] = None
    vortext: Optional[str] = None
    schlusstext: Optional[str] = None
    positions: Optional[List[Position]] = None


class Dokument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: DocType
    nummer: Optional[str] = None  # wird bei Issue vergeben
    status: Literal["entwurf", "erstellt", "storniert"] = "entwurf"
    kunde_id: Optional[str] = None
    kunde_name: str = ""
    kunde_adresse: str = ""
    kunde_email: str = ""
    betreff: str = ""
    vortext: str = ""
    schlusstext: str = ""
    positions: List[Position] = Field(default_factory=list)
    parent_id: Optional[str] = None

    # Summen (server-seitig berechnet)
    netto: float = 0.0
    mwst: float = 0.0
    brutto: float = 0.0
    lohn_netto: float = 0.0  # Summe der Lohnanteile (für §35a)

    # GoBD / Audit
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    issued_at: Optional[str] = None  # Zeitpunkt der Nummernvergabe
    issued_by: Optional[str] = None  # User der die Nummer vergeben hat
    canceled_at: Optional[str] = None
    canceled_by: Optional[str] = None
    cancel_reason: Optional[str] = None


# ============== SETTINGS ==============

class DokumenteV2Settings(BaseModel):
    feature_enabled: bool = False
    firma_name: str = "Tischlerei R.Graupner"
    # Prefix pro Typ – anpassbar
    prefix_angebot: str = "AN"
    prefix_auftrag: str = "AB"
    prefix_rechnung: str = "RE"
    prefix_gutschrift: str = "GU"
    # Zähler-Reset-Modus: "monthly" oder "yearly"
    counter_reset: Literal["monthly", "yearly"] = "monthly"
    # Nummer-Padding (0001 = 4 stellig)
    number_padding: int = 4


class DokumenteV2SettingsUpdate(BaseModel):
    feature_enabled: Optional[bool] = None
    firma_name: Optional[str] = None
    prefix_angebot: Optional[str] = None
    prefix_auftrag: Optional[str] = None
    prefix_rechnung: Optional[str] = None
    prefix_gutschrift: Optional[str] = None
    counter_reset: Optional[Literal["monthly", "yearly"]] = None
    number_padding: Optional[int] = None
