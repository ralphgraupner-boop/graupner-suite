from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    email: str = ""
    role: str = "admin"

class TokenResponse(BaseModel):
    token: str
    username: str
    role: str = "admin"


class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""
    notes: str = ""
    photos: List[str] = []
    customer_type: str = "Privat"
    categories: List[str] = []
    firma: str = ""
    anrede: str = ""
    status: str = "Neu"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CustomerCreate(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""
    notes: str = ""
    photos: List[str] = []
    customer_type: str = "Privat"
    categories: List[str] = []
    firma: str = ""
    anrede: str = ""
    status: str = "Neu"


class Anfrage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str = ""
    phone: str = ""
    address: str = ""
    notes: str = ""
    photos: List[str] = []
    categories: List[str] = []
    customer_type: str = "Privat"
    firma: str = ""
    anrede: str = ""
    source: str = "manual"
    obj_address: str = ""
    nachricht: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AnfrageUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    obj_address: Optional[str] = None
    notes: Optional[str] = None
    nachricht: Optional[str] = None
    categories: Optional[List[str]] = None
    customer_type: Optional[str] = None
    firma: Optional[str] = None
    anrede: Optional[str] = None


class TextTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    doc_type: str  # angebot, auftrag, rechnung
    text_type: str  # vortext, schlusstext
    title: str
    content: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EmailRequest(BaseModel):
    to_email: str
    subject: str = ""
    message: str = ""


class Article(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    typ: str = "Artikel"  # Artikel, Leistung, Fremdleistung
    price_net: float = 0
    ek_preis: float = 0
    aufschlag_1: float = 0
    aufschlag_2: float = 0
    aufschlag_3: float = 0
    vk_preis_1: float = 0
    vk_preis_2: float = 0
    vk_preis_3: float = 0
    unit: str = "Stück"
    subunternehmer: str = ""
    purchase_price: float = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ArticleCreate(BaseModel):
    name: str
    description: str = ""
    typ: str = "Artikel"
    price_net: float = 0
    ek_preis: float = 0
    aufschlag_1: float = 0
    aufschlag_2: float = 0
    aufschlag_3: float = 0
    vk_preis_1: float = 0
    vk_preis_2: float = 0
    vk_preis_3: float = 0
    unit: str = "Stück"
    subunternehmer: str = ""
    purchase_price: float = 0


class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    price_net: float = 0
    ek_price: float = 0
    unit: str = "Stunde"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ServiceCreate(BaseModel):
    name: str
    description: str = ""
    price_net: float = 0
    ek_price: float = 0
    unit: str = "Stunde"


class Position(BaseModel):
    pos_nr: int = 1
    description: str = ""
    quantity: float = 1
    unit: str = "Stück"
    price_net: float = 0

class Quote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quote_number: str = ""
    customer_id: str
    customer_name: str = ""
    customer_address: str = ""
    positions: List[dict] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19
    subtotal_net: float = 0
    vat_amount: float = 0
    total_gross: float = 0
    status: str = "Entwurf"
    is_template: bool = False
    valid_until: str = ""
    followup_sent: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class QuoteCreate(BaseModel):
    customer_id: str
    positions: List[Position] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = ""
    quote_id: str = ""
    customer_id: str
    customer_name: str = ""
    customer_address: str = ""
    positions: List[dict] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19
    subtotal_net: float = 0
    vat_amount: float = 0
    total_gross: float = 0
    status: str = "Offen"
    is_template: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str = ""
    order_id: Optional[str] = ""
    customer_id: str
    customer_name: str = ""
    customer_address: str = ""
    positions: List[dict] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19
    subtotal_net: float = 0
    vat_amount: float = 0
    total_gross: float = 0
    deposit_amount: float = 0
    final_amount: float = 0
    status: str = "Offen"
    paid_at: Optional[str] = None
    due_date: str = ""
    due_days: int = 14
    dunning_level: int = 0
    dunning_date: Optional[str] = None
    is_template: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class InvoiceCreate(BaseModel):
    customer_id: str
    order_id: str = ""
    positions: List[Position] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19
    deposit_amount: float = 0
    due_days: int = 14


class CompanySettings(BaseModel):
    id: str = "company_settings"
    company_name: str = "Tischlerei Graupner"
    owner_name: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    tax_id: str = ""
    iban: str = ""
    bic: str = ""
    bank_name: str = ""
    logo_url: str = ""
    company_address: str = ""
    km_rate: float = 0.30
    hourly_travel_rate: float = 45.0
    due_days: int = 14


class WebhookContact(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    telefon: str = ""
    message: str = ""
    nachricht: str = ""
    address: str = ""
    anrede: str = ""
    vorname: str = ""
    nachname: str = ""
    firma: str = ""
    strasse: str = ""
    plz: str = ""
    stadt: str = ""
    rolle: str = ""
    topics: List[str] = []
    photos: List[str] = []
    website: str = ""
    objvorname: str = ""
    objnachname: str = ""
    objstrasse: str = ""
    objplz: str = ""
    objstadt: str = ""
    objtelefon: str = ""
    objprojektnr: str = ""


class AIQuoteRequest(BaseModel):
    customer_id: str
    transcribed_text: str
    vat_rate: float = 19

class QuoteUpdate(BaseModel):
    positions: List[Position] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19
    status: str = ""
    custom_total: Optional[float] = None

class OrderUpdate(BaseModel):
    positions: List[Position] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19
    status: str = ""
    custom_total: Optional[float] = None

class InvoiceUpdate(BaseModel):
    positions: List[Position] = []
    notes: str = ""
    vortext: str = ""
    schlusstext: str = ""
    vat_rate: float = 19
    status: str = ""
    deposit_amount: float = 0
    custom_total: Optional[float] = None

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

class PushUnsubscribe(BaseModel):
    endpoint: str
