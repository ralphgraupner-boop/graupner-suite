from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Body
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
from io import BytesIO
import asyncio
import base64
import json
import httpx

# PDF Generation
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Push Notifications
from pywebpush import webpush, WebPushException

# Emergent Integrations
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import OpenAISpeechToText

# Email
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    JWT_SECRET = 'graupner-suite-secret-' + os.environ.get('DB_NAME', 'default')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')

# Initialize Resend
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Create the main app
app = FastAPI(title="Graupner Suite API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    company_name: str = "Tischlerei Graupner"

class TokenResponse(BaseModel):
    token: str
    username: str

class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: str = ""
    notes: str = ""
    photos: List[str] = []
    customer_type: str = "Privat"  # Privat, Vermieter, Mieter, Gewerblich, Hausverwaltung
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: str = ""
    notes: str = ""
    photos: List[str] = []
    customer_type: str = "Privat"

class Article(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    unit: str = "Stück"
    price_net: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ArticleCreate(BaseModel):
    name: str
    description: str = ""
    unit: str = "Stück"
    price_net: float

class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    unit: str = "Stunde"
    price_net: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ServiceCreate(BaseModel):
    name: str
    description: str = ""
    unit: str = "Stunde"
    price_net: float

class Position(BaseModel):
    pos_nr: int
    description: str
    quantity: float
    unit: str = "Stück"
    price_net: float

class Quote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quote_number: str
    customer_id: str
    customer_name: str
    customer_address: str
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    subtotal_net: float
    vat_amount: float
    total_gross: float
    status: str = "Entwurf"
    is_template: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    valid_until: str = ""

class QuoteCreate(BaseModel):
    customer_id: str
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    valid_days: int = 30

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    quote_id: str
    customer_id: str
    customer_name: str
    customer_address: str
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    subtotal_net: float
    vat_amount: float
    total_gross: float
    status: str = "Offen"
    is_template: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Invoice(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invoice_number: str
    order_id: Optional[str] = None
    customer_id: str
    customer_name: str
    customer_address: str
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    subtotal_net: float
    vat_amount: float
    total_gross: float
    deposit_amount: float = 0.0
    final_amount: float = 0.0
    status: str = "Offen"
    is_template: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    due_date: str = ""
    paid_at: Optional[str] = None

class InvoiceCreate(BaseModel):
    customer_id: str
    order_id: Optional[str] = None
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    due_days: int = 14
    deposit_amount: float = 0.0

class CompanySettings(BaseModel):
    id: str = "company_settings"
    company_name: str = "Tischlerei Graupner"
    owner_name: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    tax_id: str = ""
    bank_name: str = ""
    iban: str = ""
    bic: str = ""
    default_vat_rate: float = 19.0
    is_small_business: bool = False
    logo_base64: str = ""

class WebhookContact(BaseModel):
    # Basic fields (backward compatible)
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: str = ""
    message: str = ""
    photos: List[str] = []
    # Graupner website form fields
    rolle: Optional[str] = None  # Eigentümer/Vermieter, Hausverwaltung, Mieter, Interessent
    anrede: Optional[str] = None  # Herr, Frau
    vorname: Optional[str] = None
    nachname: Optional[str] = None
    firma: Optional[str] = None
    telefon: Optional[str] = None
    website: Optional[str] = None
    strasse: Optional[str] = None
    plz: Optional[str] = None
    stadt: Optional[str] = None
    # Object address
    objanrede: Optional[str] = None
    objvorname: Optional[str] = None
    objnachname: Optional[str] = None
    objtelefon: Optional[str] = None
    objemail: Optional[str] = None
    objstrasse: Optional[str] = None
    objplz: Optional[str] = None
    objstadt: Optional[str] = None
    objprojektnr: Optional[str] = None
    bewohnt: Optional[str] = None
    # Topics
    topics: List[str] = []
    nachricht: Optional[str] = None

class AIQuoteRequest(BaseModel):
    customer_id: str
    transcribed_text: str
    vat_rate: float = 19.0

class QuoteUpdate(BaseModel):
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    status: Optional[str] = None
    is_template: Optional[bool] = None
    custom_total: Optional[float] = None

class OrderUpdate(BaseModel):
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    status: Optional[str] = None
    is_template: Optional[bool] = None
    custom_total: Optional[float] = None

class InvoiceUpdate(BaseModel):
    positions: List[Position]
    notes: str = ""
    vat_rate: float = 19.0
    status: Optional[str] = None
    is_template: Optional[bool] = None
    custom_total: Optional[float] = None
    deposit_amount: float = 0.0

class EmailRequest(BaseModel):
    recipient_email: EmailStr
    subject: str
    document_type: str  # "quote", "order", "invoice"
    document_id: str

# ==================== AUTH ====================

async def get_current_user(token: str = None):
    if not token:
        raise HTTPException(status_code=401, detail="Token fehlt")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"username": user.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Benutzer existiert bereits")
    
    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
    user_doc = {
        "id": str(uuid.uuid4()),
        "username": user.username,
        "password": hashed,
        "company_name": user.company_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = jwt.encode({"username": user.username, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7}, JWT_SECRET)
    return {"token": token, "username": user.username}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user: UserLogin):
    existing = await db.users.find_one({"username": user.username}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=401, detail="Benutzer nicht gefunden")
    
    if not bcrypt.checkpw(user.password.encode(), existing["password"].encode()):
        raise HTTPException(status_code=401, detail="Falsches Passwort")
    
    token = jwt.encode({"username": user.username, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7}, JWT_SECRET)
    return {"token": token, "username": user.username}

@api_router.get("/auth/me")
async def get_me(token: str):
    user = await get_current_user(token)
    return {"username": user["username"]}

# ==================== CUSTOMERS ====================

@api_router.get("/customers", response_model=List[Customer])
async def get_customers():
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    return customers

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return customer

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    customer_obj = Customer(**customer.model_dump())
    await db.customers.insert_one(customer_obj.model_dump())
    return customer_obj

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer: CustomerCreate):
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    updated = {**existing, **customer.model_dump()}
    await db.customers.update_one({"id": customer_id}, {"$set": updated})
    return updated

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return {"message": "Kunde gelöscht"}

# ==================== ARTICLES ====================

@api_router.get("/articles", response_model=List[Article])
async def get_articles():
    articles = await db.articles.find({}, {"_id": 0}).to_list(1000)
    return articles

@api_router.post("/articles", response_model=Article)
async def create_article(article: ArticleCreate):
    article_obj = Article(**article.model_dump())
    await db.articles.insert_one(article_obj.model_dump())
    return article_obj

@api_router.put("/articles/{article_id}", response_model=Article)
async def update_article(article_id: str, article: ArticleCreate):
    existing = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    
    updated = {**existing, **article.model_dump()}
    await db.articles.update_one({"id": article_id}, {"$set": updated})
    return updated

@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str):
    result = await db.articles.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artikel nicht gefunden")
    return {"message": "Artikel gelöscht"}

# ==================== SERVICES (LEISTUNGEN) ====================

@api_router.get("/services", response_model=List[Service])
async def get_services():
    services = await db.services.find({}, {"_id": 0}).to_list(1000)
    return services

@api_router.post("/services", response_model=Service)
async def create_service(service: ServiceCreate):
    service_obj = Service(**service.model_dump())
    await db.services.insert_one(service_obj.model_dump())
    return service_obj

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, service: ServiceCreate):
    existing = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")
    
    updated = {**existing, **service.model_dump()}
    await db.services.update_one({"id": service_id}, {"$set": updated})
    return updated

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str):
    result = await db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leistung nicht gefunden")
    return {"message": "Leistung gelöscht"}

# ==================== QUOTES ====================

async def get_next_quote_number():
    counter = await db.counters.find_one_and_update(
        {"_id": "quote_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"A-{datetime.now().year}-{str(counter['seq']).zfill(4)}"

@api_router.get("/quotes", response_model=List[Quote])
async def get_quotes():
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(1000)
    return quotes

@api_router.get("/quotes/{quote_id}", response_model=Quote)
async def get_quote(quote_id: str):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    return quote

@api_router.post("/quotes", response_model=Quote)
async def create_quote(quote: QuoteCreate):
    customer = await db.customers.find_one({"id": quote.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    quote_number = await get_next_quote_number()
    
    subtotal_net = sum(p.quantity * p.price_net for p in quote.positions)
    vat_amount = subtotal_net * (quote.vat_rate / 100) if quote.vat_rate > 0 else 0
    total_gross = subtotal_net + vat_amount
    
    valid_until = datetime.now(timezone.utc)
    from datetime import timedelta
    valid_until = (valid_until + timedelta(days=quote.valid_days)).isoformat()
    
    quote_obj = Quote(
        quote_number=quote_number,
        customer_id=quote.customer_id,
        customer_name=customer["name"],
        customer_address=customer.get("address", ""),
        positions=[p.model_dump() for p in quote.positions],
        notes=quote.notes,
        vat_rate=quote.vat_rate,
        subtotal_net=round(subtotal_net, 2),
        vat_amount=round(vat_amount, 2),
        total_gross=round(total_gross, 2),
        valid_until=valid_until
    )
    
    await db.quotes.insert_one(quote_obj.model_dump())
    return quote_obj

@api_router.put("/quotes/{quote_id}", response_model=Quote)
async def update_quote(quote_id: str, update: QuoteUpdate):
    """Angebot bearbeiten mit optionaler Gesamtsummen-Anpassung"""
    existing = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    
    positions = update.positions
    
    # Wenn custom_total gesetzt ist, Positionen proportional anpassen
    if update.custom_total is not None and update.custom_total > 0:
        current_total = sum(p.quantity * p.price_net for p in positions)
        if current_total > 0:
            # Brutto -> Netto umrechnen
            target_net = update.custom_total / (1 + update.vat_rate / 100)
            factor = target_net / current_total
            for p in positions:
                p.price_net = round(p.price_net * factor, 2)
    
    subtotal_net = sum(p.quantity * p.price_net for p in positions)
    vat_amount = subtotal_net * (update.vat_rate / 100) if update.vat_rate > 0 else 0
    total_gross = subtotal_net + vat_amount
    
    update_data = {
        "positions": [p.model_dump() for p in positions],
        "notes": update.notes,
        "vat_rate": update.vat_rate,
        "subtotal_net": round(subtotal_net, 2),
        "vat_amount": round(vat_amount, 2),
        "total_gross": round(total_gross, 2)
    }
    
    if update.status:
        update_data["status"] = update.status
    
    await db.quotes.update_one({"id": quote_id}, {"$set": update_data})
    
    updated = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    return updated

@api_router.put("/quotes/{quote_id}/status")
async def update_quote_status(quote_id: str, status: str = Body(..., embed=True)):
    result = await db.quotes.update_one({"id": quote_id}, {"$set": {"status": status}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    return {"message": "Status aktualisiert"}

@api_router.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str):
    result = await db.quotes.delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    return {"message": "Angebot gelöscht"}

# ==================== ORDERS ====================

async def get_next_order_number():
    counter = await db.counters.find_one_and_update(
        {"_id": "order_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"AB-{datetime.now().year}-{str(counter['seq']).zfill(4)}"

@api_router.get("/orders", response_model=List[Order])
async def get_orders():
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    return orders

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return order

@api_router.post("/orders/from-quote/{quote_id}", response_model=Order)
async def create_order_from_quote(quote_id: str):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    
    order_number = await get_next_order_number()
    
    order_obj = Order(
        order_number=order_number,
        quote_id=quote_id,
        customer_id=quote["customer_id"],
        customer_name=quote["customer_name"],
        customer_address=quote["customer_address"],
        positions=quote["positions"],
        notes=quote.get("notes", ""),
        vat_rate=quote["vat_rate"],
        subtotal_net=quote["subtotal_net"],
        vat_amount=quote["vat_amount"],
        total_gross=quote["total_gross"]
    )
    
    await db.orders.insert_one(order_obj.model_dump())
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "Beauftragt"}})
    
    return order_obj

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str = Body(..., embed=True)):
    result = await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return {"message": "Status aktualisiert"}

@api_router.put("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, update: OrderUpdate):
    """Auftrag bearbeiten mit optionaler Gesamtsummen-Anpassung"""
    existing = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    
    positions = update.positions
    
    # Wenn custom_total gesetzt ist, Positionen proportional anpassen
    if update.custom_total is not None and update.custom_total > 0:
        current_total = sum(p.quantity * p.price_net for p in positions)
        if current_total > 0:
            target_net = update.custom_total / (1 + update.vat_rate / 100)
            factor = target_net / current_total
            for p in positions:
                p.price_net = round(p.price_net * factor, 2)
    
    subtotal_net = sum(p.quantity * p.price_net for p in positions)
    vat_amount = subtotal_net * (update.vat_rate / 100) if update.vat_rate > 0 else 0
    total_gross = subtotal_net + vat_amount
    
    update_data = {
        "positions": [p.model_dump() for p in positions],
        "notes": update.notes,
        "vat_rate": update.vat_rate,
        "subtotal_net": round(subtotal_net, 2),
        "vat_amount": round(vat_amount, 2),
        "total_gross": round(total_gross, 2)
    }
    
    if update.status:
        update_data["status"] = update.status
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    return {"message": "Auftrag gelöscht"}

# ==================== INVOICES ====================

async def get_next_invoice_number():
    counter = await db.counters.find_one_and_update(
        {"_id": "invoice_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return f"R-{datetime.now().year}-{str(counter['seq']).zfill(4)}"

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices():
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    return invoices

@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return invoice

@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(invoice: InvoiceCreate):
    customer = await db.customers.find_one({"id": invoice.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    invoice_number = await get_next_invoice_number()
    
    subtotal_net = sum(p.quantity * p.price_net for p in invoice.positions)
    vat_amount = subtotal_net * (invoice.vat_rate / 100) if invoice.vat_rate > 0 else 0
    total_gross = subtotal_net + vat_amount
    final_amount = total_gross - invoice.deposit_amount
    
    from datetime import timedelta
    due_date = (datetime.now(timezone.utc) + timedelta(days=invoice.due_days)).isoformat()
    
    invoice_obj = Invoice(
        invoice_number=invoice_number,
        order_id=invoice.order_id,
        customer_id=invoice.customer_id,
        customer_name=customer["name"],
        customer_address=customer.get("address", ""),
        positions=[p.model_dump() for p in invoice.positions],
        notes=invoice.notes,
        vat_rate=invoice.vat_rate,
        subtotal_net=round(subtotal_net, 2),
        vat_amount=round(vat_amount, 2),
        total_gross=round(total_gross, 2),
        deposit_amount=round(invoice.deposit_amount, 2),
        final_amount=round(final_amount, 2),
        due_date=due_date
    )
    
    await db.invoices.insert_one(invoice_obj.model_dump())
    return invoice_obj

@api_router.post("/invoices/from-order/{order_id}", response_model=Invoice)
async def create_invoice_from_order(order_id: str, due_days: int = Body(14, embed=True)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    
    invoice_number = await get_next_invoice_number()
    
    from datetime import timedelta
    due_date = (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat()
    
    invoice_obj = Invoice(
        invoice_number=invoice_number,
        order_id=order_id,
        customer_id=order["customer_id"],
        customer_name=order["customer_name"],
        customer_address=order["customer_address"],
        positions=order["positions"],
        notes=order.get("notes", ""),
        vat_rate=order["vat_rate"],
        subtotal_net=order["subtotal_net"],
        vat_amount=order["vat_amount"],
        total_gross=order["total_gross"],
        due_date=due_date
    )
    
    await db.invoices.insert_one(invoice_obj.model_dump())
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "Abgerechnet"}})
    
    return invoice_obj

@api_router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, status: str = Body(..., embed=True)):
    update_data = {"status": status}
    if status == "Bezahlt":
        update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
    elif status == "Offen":
        update_data["paid_at"] = None
    
    result = await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return {"message": "Status aktualisiert"}

@api_router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, update: InvoiceUpdate):
    """Rechnung bearbeiten mit Anzahlung und optionaler Gesamtsummen-Anpassung"""
    existing = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    
    positions = update.positions
    
    # Wenn custom_total gesetzt ist, Positionen proportional anpassen
    if update.custom_total is not None and update.custom_total > 0:
        current_total = sum(p.quantity * p.price_net for p in positions)
        if current_total > 0:
            target_net = update.custom_total / (1 + update.vat_rate / 100)
            factor = target_net / current_total
            for p in positions:
                p.price_net = round(p.price_net * factor, 2)
    
    subtotal_net = sum(p.quantity * p.price_net for p in positions)
    vat_amount = subtotal_net * (update.vat_rate / 100) if update.vat_rate > 0 else 0
    total_gross = subtotal_net + vat_amount
    final_amount = total_gross - update.deposit_amount
    
    update_data = {
        "positions": [p.model_dump() for p in positions],
        "notes": update.notes,
        "vat_rate": update.vat_rate,
        "subtotal_net": round(subtotal_net, 2),
        "vat_amount": round(vat_amount, 2),
        "total_gross": round(total_gross, 2),
        "deposit_amount": round(update.deposit_amount, 2),
        "final_amount": round(final_amount, 2)
    }
    
    if update.status:
        update_data["status"] = update.status
        if update.status == "Bezahlt":
            update_data["paid_at"] = datetime.now(timezone.utc).isoformat()
        elif update.status == "Offen":
            update_data["paid_at"] = None
    
    await db.invoices.update_one({"id": invoice_id}, {"$set": update_data})
    
    updated = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    return updated

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    result = await db.invoices.delete_one({"id": invoice_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    return {"message": "Rechnung gelöscht"}

# ==================== SETTINGS ====================

@api_router.get("/settings", response_model=CompanySettings)
async def get_settings():
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        return CompanySettings()
    return settings

@api_router.put("/settings", response_model=CompanySettings)
async def update_settings(settings: CompanySettings):
    await db.settings.update_one(
        {"id": "company_settings"},
        {"$set": settings.model_dump()},
        upsert=True
    )
    return settings

# ==================== PUSH NOTIFICATIONS ====================

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

@api_router.post("/push/subscribe")
async def push_subscribe(subscription: PushSubscription):
    """Browser Push-Benachrichtigung abonnieren"""
    existing = await db.push_subscriptions.find_one({"endpoint": subscription.endpoint})
    if existing:
        await db.push_subscriptions.update_one(
            {"endpoint": subscription.endpoint},
            {"$set": {"keys": subscription.keys, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.push_subscriptions.insert_one({
            "endpoint": subscription.endpoint,
            "keys": subscription.keys,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    return {"message": "Push-Benachrichtigung aktiviert"}

@api_router.delete("/push/subscribe")
async def push_unsubscribe(subscription: PushSubscription):
    """Browser Push-Benachrichtigung deaktivieren"""
    await db.push_subscriptions.delete_one({"endpoint": subscription.endpoint})
    return {"message": "Push-Benachrichtigung deaktiviert"}

class PushUnsubscribe(BaseModel):
    endpoint: str

@api_router.post("/push/unsubscribe")
async def push_unsubscribe_post(data: PushUnsubscribe):
    """Browser Push-Benachrichtigung deaktivieren (POST)"""
    await db.push_subscriptions.delete_one({"endpoint": data.endpoint})
    return {"message": "Push-Benachrichtigung deaktiviert"}

@api_router.get("/push/vapid-key")
async def get_vapid_key():
    """VAPID Public Key für Push-Benachrichtigungen"""
    return {"vapid_public_key": VAPID_PUBLIC_KEY}

@api_router.post("/push/test")
async def push_test():
    """Test Push-Benachrichtigung an alle Abonnenten"""
    subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(100)
    if not subs:
        return {"success": False, "message": "Keine Push-Subscriptions vorhanden. Bitte zuerst aktivieren.", "subscribers": 0}
    await send_push_to_all(
        title="Test-Benachrichtigung",
        body="Wenn Sie das lesen, funktionieren Push-Benachrichtigungen!",
        url="/dashboard"
    )
    return {"success": True, "message": f"Push an {len(subs)} Gerät(e) gesendet", "subscribers": len(subs)}

async def send_push_to_all(title: str, body: str, url: str = "/"):
    """Push-Benachrichtigung an alle Abonnenten senden"""
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID keys not configured, skipping push")
        return
    subscriptions = await db.push_subscriptions.find({}, {"_id": 0}).to_list(100)
    logger.info(f"Sending push to {len(subscriptions)} subscribers: {title}")
    payload = json.dumps({"title": title, "body": body, "url": url})
    for sub in subscriptions:
        try:
            webpush(
                subscription_info={"endpoint": sub["endpoint"], "keys": sub["keys"]},
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": "mailto:info@graupner-suite.de"}
            )
            logger.info(f"Push sent successfully to {sub['endpoint'][:50]}")
        except WebPushException as e:
            logger.error(f"Push failed for {sub['endpoint'][:50]}: {e}")
            is_gone = False
            if hasattr(e, 'response') and e.response is not None and hasattr(e.response, 'status_code'):
                is_gone = e.response.status_code in (404, 410)
            if not is_gone and ("410" in str(e) or "Gone" in str(e) or "expired" in str(e)):
                is_gone = True
            if is_gone:
                await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
                logger.info(f"Removed expired subscription: {sub['endpoint'][:50]}")
        except Exception as e:
            logger.error(f"Push unexpected error: {e}")

# ==================== WEBHOOK ====================

@api_router.post("/webhook/contact")
async def webhook_contact(contact: WebhookContact):
    """Webhook für Website-Kontaktformular (Graupner)"""
    # Build name from form fields
    name_parts = []
    if contact.anrede:
        name_parts.append(contact.anrede)
    if contact.vorname:
        name_parts.append(contact.vorname)
    if contact.nachname:
        name_parts.append(contact.nachname)
    name = " ".join(name_parts) if name_parts else (contact.name or "Unbekannt")
    if contact.firma:
        name = f"{name} ({contact.firma})"

    # Build address
    address_parts = []
    if contact.strasse:
        address_parts.append(contact.strasse)
    if contact.plz or contact.stadt:
        address_parts.append(f"{contact.plz or ''} {contact.stadt or ''}".strip())
    address = "\n".join(address_parts) if address_parts else contact.address

    # Build notes from topics, message, object address
    notes_parts = []
    if contact.rolle:
        notes_parts.append(f"Rolle: {contact.rolle}")
    if contact.topics:
        notes_parts.append(f"Themen: {', '.join(contact.topics)}")
    msg = contact.nachricht or contact.message
    if msg:
        notes_parts.append(f"Nachricht: {msg}")
    if contact.objstrasse:
        obj_addr = f"Objektadresse: {contact.objstrasse}"
        if contact.objplz or contact.objstadt:
            obj_addr += f", {contact.objplz or ''} {contact.objstadt or ''}".strip()
        if contact.objvorname or contact.objnachname:
            obj_addr += f" (Kontakt: {contact.objvorname or ''} {contact.objnachname or ''})".strip()
        if contact.objprojektnr:
            obj_addr += f" [Projekt-Nr: {contact.objprojektnr}]"
        notes_parts.append(obj_addr)
    if contact.website:
        notes_parts.append(f"Website: {contact.website}")

    # Map rolle to customer_type
    rolle_map = {
        "Eigentümer/Vermieter": "Vermieter",
        "Hausverwaltung": "Hausverwaltung",
        "Mieter": "Mieter",
        "Interessent Tischlerarbeiten": "Privat"
    }
    customer_type = rolle_map.get(contact.rolle, "Privat")

    customer = Customer(
        name=name,
        email=contact.email or "",
        phone=contact.telefon or contact.phone or "",
        address=address,
        notes="\n".join(notes_parts),
        photos=contact.photos,
        customer_type=customer_type
    )
    await db.customers.insert_one(customer.model_dump())
    logger.info(f"Neue Kundenanfrage über Webhook: {name} ({customer_type})")

    # Build push message
    push_body = f"{name}"
    if contact.topics:
        push_body += f" - {', '.join(contact.topics[:3])}"
    elif msg:
        push_body += f": {msg[:80]}"

    await send_push_to_all(
        title="Neue Kundenanfrage",
        body=push_body,
        url="/customers"
    )

    return {"message": "Anfrage erfolgreich empfangen", "customer_id": customer.id}

@api_router.get("/webhook/contact-beacon")
async def webhook_contact_beacon(name: str = "", nachricht: str = "", email: str = "", phone: str = ""):
    """GET-Webhook als Bild-Beacon (umgeht CORS-Blockierung bei IONOS u.a.)"""
    if not name:
        # 1x1 transparent pixel
        pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
        return StreamingResponse(BytesIO(pixel), media_type="image/gif")

    contact = WebhookContact(name=name, nachricht=nachricht, email=email, phone=phone)
    # Reuse existing webhook logic
    msg = contact.nachricht or contact.message
    notes_parts = []
    if msg:
        notes_parts.append(f"Nachricht: {msg}")

    customer = Customer(
        name=name,
        email=email,
        phone=phone,
        notes="\n".join(notes_parts),
        customer_type="Privat"
    )
    await db.customers.insert_one(customer.model_dump())
    logger.info(f"Neue Kundenanfrage über Beacon-Webhook: {name}")

    push_body = f"{name}"
    if msg:
        push_body += f": {msg[:80]}"
    await send_push_to_all(title="Neue Kundenanfrage", body=push_body, url="/customers")

    # Return 1x1 transparent GIF
    pixel = base64.b64decode("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")
    return StreamingResponse(BytesIO(pixel), media_type="image/gif")

# ==================== PUBLIC CONTACT FORM RELAY ====================

from fastapi import Request, Form as FastAPIForm
from fastapi.responses import HTMLResponse

ORIGINAL_FORM_URL = "https://www.kontakt-graupner.de/kontakt/response.php"

@api_router.get("/kontakt", response_class=HTMLResponse)
async def kontakt_form_page():
    """Public contact form page - no auth required"""
    backend_url = os.environ.get("REACT_APP_BACKEND_URL", "")
    return HTMLResponse(content=f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Kontaktformular - Tischlerei Graupner</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;color:#1a1a2e;line-height:1.6}}
.header{{background:#1a1a2e;color:#fff;padding:20px 0;text-align:center}}
.header h1{{font-size:20px;font-weight:600}}
.header p{{font-size:13px;opacity:0.7;margin-top:2px}}
.container{{max-width:640px;margin:24px auto;padding:0 16px}}
.card{{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06);padding:24px;margin-bottom:16px}}
.card h2{{font-size:15px;font-weight:600;margin-bottom:14px;padding-bottom:6px;border-bottom:2px solid #eee;color:#1a1a2e}}
.row{{display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap}}
.field{{flex:1;min-width:160px}}
label{{display:block;font-size:12px;font-weight:500;margin-bottom:3px;color:#555}}
input[type=text],input[type=email],input[type=tel],textarea{{width:100%;padding:9px 11px;border:1.5px solid #ddd;border-radius:8px;font-size:14px;transition:border-color 0.2s}}
input:focus,textarea:focus{{outline:none;border-color:#1a1a2e;box-shadow:0 0 0 3px rgba(26,26,46,0.08)}}
textarea{{resize:vertical;min-height:80px}}
.radio-group{{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}}
.radio-group label{{display:flex;align-items:center;gap:5px;padding:7px 12px;border:1.5px solid #ddd;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.2s}}
.radio-group label:has(input:checked){{border-color:#1a1a2e;background:#f0f0ff}}
.topic-grid{{display:flex;flex-wrap:wrap;gap:6px}}
.topic-grid label{{display:flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid #ddd;border-radius:20px;cursor:pointer;font-size:12px;transition:all 0.2s;white-space:nowrap}}
.topic-grid label:has(input:checked){{border-color:#1a1a2e;background:#1a1a2e;color:#fff}}
.topic-grid input{{display:none}}
.copy-check{{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f0f4ff;border-radius:8px;cursor:pointer;font-size:13px;margin-bottom:12px;border:1.5px solid transparent;transition:all 0.2s}}
.copy-check:has(input:checked){{border-color:#1a1a2e;background:#e8ecff}}
.copy-check input{{width:16px;height:16px}}
.obj-fields{{transition:opacity 0.3s;}}
.btn{{display:block;width:100%;padding:14px;background:#1a1a2e;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.2s}}
.btn:hover{{background:#2a2a4e}}
.required::after{{content:" *";color:#e74c3c}}
.privacy{{display:flex;align-items:start;gap:10px;padding:14px 16px;background:#fff;border-radius:10px;border:1.5px solid #ddd;cursor:pointer;font-size:14px;margin-bottom:16px}}
.privacy input{{width:20px;height:20px;margin-top:1px;flex-shrink:0;cursor:pointer}}
.file-info{{font-size:11px;color:#888;margin-top:3px}}
input[type=file]{{padding:7px;font-size:13px}}
.hidden{{display:none}}
</style>
</head>
<body>
<div class="header">
<h1>Tischlerei Graupner</h1>
<p>Fenster und T&uuml;ren reparieren seit 1960</p>
</div>
<div class="container">
<form action="{backend_url}/api/kontakt/submit" method="POST" enctype="multipart/form-data">
<input type="hidden" name="rolle" value="Eigent&uuml;mer/Vermieter">

<div class="card">
<h2>Kontaktdaten</h2>
<div class="radio-group">
<label><input type="radio" name="anrede" value="Herr"><span>Herr</span></label>
<label><input type="radio" name="anrede" value="Frau"><span>Frau</span></label>
</div>
<div class="row">
<div class="field"><label>Vorname</label><input type="text" name="vorname" id="k_vorname"></div>
<div class="field"><label class="required">Nachname</label><input type="text" name="nachname" id="k_nachname" required></div>
</div>
<div class="row">
<div class="field"><label>Firma</label><input type="text" name="firma"></div>
<div class="field"><label class="required">Telefon</label><input type="tel" name="telefon" id="k_telefon" required></div>
</div>
<div class="row">
<div class="field"><label class="required">E-Mail</label><input type="email" name="email" required></div>
</div>
<div class="row">
<div class="field"><label class="required">Stra&szlig;e, Nr.</label><input type="text" name="strasse" id="k_strasse" required></div>
<div class="field" style="max-width:100px"><label class="required">PLZ</label><input type="text" name="plz" id="k_plz" required></div>
<div class="field"><label class="required">Stadt</label><input type="text" name="stadt" id="k_stadt" required></div>
</div>
</div>

<div class="card">
<h2>Objektadresse</h2>
<label class="copy-check">
<input type="checkbox" id="copyAddr" onchange="toggleCopy()">
Kontaktdaten als Objektadresse &uuml;bernehmen
</label>
<div class="obj-fields" id="objFields">
<div class="row">
<div class="field"><label>Vorname</label><input type="text" name="objvorname" id="o_vorname"></div>
<div class="field"><label>Nachname</label><input type="text" name="objnachname" id="o_nachname"></div>
<div class="field"><label>Telefon</label><input type="tel" name="objtelefon" id="o_telefon"></div>
</div>
<div class="row">
<div class="field"><label>Stra&szlig;e</label><input type="text" name="objstrasse" id="o_strasse"></div>
<div class="field" style="max-width:100px"><label>PLZ</label><input type="text" name="objplz" id="o_plz"></div>
<div class="field"><label>Stadt</label><input type="text" name="objstadt" id="o_stadt"></div>
</div>
</div>
</div>

<div class="card">
<h2>Was wird ben&ouml;tigt?</h2>
<div class="topic-grid">
<label><input type="checkbox" name="topic[]" value="Fenster">Fenster</label>
<label><input type="checkbox" name="topic[]" value="Balkont&uuml;r">Balkont&uuml;r</label>
<label><input type="checkbox" name="topic[]" value="Terrassent&uuml;r">Terrassent&uuml;r</label>
<label><input type="checkbox" name="topic[]" value="Schiebet&uuml;r Balon">Schiebet&uuml;r</label>
<label><input type="checkbox" name="topic[]" value="Zimmert&uuml;r">Zimmert&uuml;r</label>
<label><input type="checkbox" name="topic[]" value="Wohnungst&uuml;r">Wohnungst&uuml;r</label>
<label><input type="checkbox" name="topic[]" value="Schrank">Schrank</label>
<label><input type="checkbox" name="topic[]" value="Boden">Boden</label>
<label><input type="checkbox" name="topic[]" value="Sonstiges">Sonstiges</label>
</div>
</div>

<div class="card">
<h2>Nachricht &amp; Bilder</h2>
<textarea name="nachricht" placeholder="Beschreiben Sie Ihr Anliegen..." rows="4"></textarea>
<div style="margin-top:10px">
<label>Bilder hochladen</label>
<input type="file" name="upload_file1" accept="image/*" multiple>
<p class="file-info">Optional: Fotos vom Objekt (max. 50 MB)</p>
</div>
</div>

<label class="privacy">
<input type="checkbox" name="dataprivacy" required>
<span>Ich habe die <a href="https://www.tischlerei-graupner.de/j/privacy" target="_blank" style="color:#1a1a2e;font-weight:600;text-decoration:underline;">Datenschutzerkl&auml;rung</a> gelesen und stimme zu.</span>
</label>

<button type="submit" class="btn">Anfrage absenden</button>
</form>
</div>

<script>
function toggleCopy(){{
  var c=document.getElementById('copyAddr').checked;
  var pairs=[['k_vorname','o_vorname'],['k_nachname','o_nachname'],['k_telefon','o_telefon'],['k_strasse','o_strasse'],['k_plz','o_plz'],['k_stadt','o_stadt']];
  var fields=document.getElementById('objFields');
  if(c){{
    pairs.forEach(function(p){{document.getElementById(p[1]).value=document.getElementById(p[0]).value;}});
    fields.style.opacity='0.4';
    fields.querySelectorAll('input').forEach(function(i){{i.readOnly=true;}});
  }}else{{
    fields.style.opacity='1';
    fields.querySelectorAll('input').forEach(function(i){{i.readOnly=false;}});
  }}
}}
</script>
</body>
</html>""")

@api_router.post("/kontakt/submit")
async def kontakt_relay(request: Request):
    """Receives the public contact form, saves to Graupner Suite, then forwards to original response.php"""
    form_data = await request.form()
    form_dict = {}
    files_list = []
    
    for key, value in form_data.multi_items():
        if hasattr(value, 'read'):
            content = await value.read()
            if content:
                files_list.append((key, (value.filename, content, value.content_type or "application/octet-stream")))
        else:
            if key in form_dict:
                if isinstance(form_dict[key], list):
                    form_dict[key].append(value)
                else:
                    form_dict[key] = [form_dict[key], value]
            else:
                form_dict[key] = value
    
    # 1. Save to Graupner Suite (reuse webhook logic)
    try:
        topics = form_dict.get("topic[]", form_dict.get("topic", []))
        if isinstance(topics, str):
            topics = [topics]
        
        anrede = form_dict.get("anrede", "")
        vorname = form_dict.get("vorname", "")
        nachname = form_dict.get("nachname", "")
        name = f"{anrede} {vorname} {nachname}".strip() or form_dict.get("name", "Unbekannt")
        
        address_parts = [form_dict.get("strasse", ""), form_dict.get("plz", ""), form_dict.get("stadt", "")]
        address = ", ".join(p for p in address_parts if p)
        
        notes_parts = []
        if form_dict.get("rolle"):
            notes_parts.append(f"Rolle: {form_dict['rolle']}")
        if form_dict.get("firma"):
            notes_parts.append(f"Firma: {form_dict['firma']}")
        if topics:
            notes_parts.append(f"Themen: {', '.join(topics)}")
        obj_parts = [form_dict.get("objstrasse", ""), form_dict.get("objplz", ""), form_dict.get("objstadt", "")]
        obj_addr = ", ".join(p for p in obj_parts if p)
        if obj_addr:
            notes_parts.append(f"Objektadresse: {obj_addr}")
        if form_dict.get("nachricht"):
            notes_parts.append(f"Nachricht: {form_dict['nachricht']}")
        
        rolle_map = {"Eigentümer/Vermieter": "Vermieter", "Hausverwaltung": "Hausverwaltung", "Mieter": "Mieter", "Interessent Tischlerarbeiten": "Privat"}
        customer_type = rolle_map.get(form_dict.get("rolle", ""), "Privat")
        
        customer = Customer(
            name=name,
            email=form_dict.get("email", ""),
            phone=form_dict.get("telefon", ""),
            address=address,
            notes="\n".join(notes_parts),
            customer_type=customer_type
        )
        await db.customers.insert_one(customer.model_dump())
        logger.info(f"Neue Kundenanfrage über Kontaktformular-Relay: {name}")
        
        push_body = f"{name}"
        if topics:
            push_body += f" ({', '.join(topics[:2])})"
        await send_push_to_all(title="Neue Kundenanfrage", body=push_body, url="/customers")
    except Exception as e:
        logger.error(f"Fehler beim Speichern in Graupner Suite: {e}")
    
    # 2. Forward EVERYTHING to original response.php (in background thread)
    try:
        import requests as sync_requests
        
        # Build form data for forwarding (handle multi-value fields like topic[])
        forward_items = []
        for key, value in form_dict.items():
            if isinstance(value, list):
                for v in value:
                    forward_items.append((key, v))
            else:
                forward_items.append((key, value))
        
        forward_files = []
        for key, (filename, content, content_type) in files_list:
            forward_files.append((key, (filename, content, content_type)))
        
        def do_forward():
            try:
                if forward_files:
                    resp = sync_requests.post(ORIGINAL_FORM_URL, data=forward_items, files=forward_files, timeout=15, verify=False)
                else:
                    resp = sync_requests.post(ORIGINAL_FORM_URL, data=forward_items, timeout=15, verify=False)
                logger.info(f"Weiterleitung an response.php: HTTP {resp.status_code}")
                return resp
            except Exception as ex:
                logger.error(f"Forward-Fehler: {ex}")
                return None
        
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(do_forward)
            resp = future.result(timeout=20)
        
        if resp and resp.status_code == 200:
            return HTMLResponse(content="""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Anfrage gesendet - Tischlerei Graupner</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fa;color:#1a1a2e;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
.box{text-align:center;max-width:500px;padding:48px 32px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08)}
.check{width:72px;height:72px;background:#e8f5e9;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
.check svg{width:36px;height:36px;color:#2e7d32}
h1{font-size:22px;margin-bottom:8px}
p{font-size:15px;color:#666;line-height:1.6;margin-bottom:16px}
.info{background:#f0f4ff;border-radius:10px;padding:16px;margin:20px 0;text-align:left;font-size:13px;color:#444;line-height:1.7}
.info b{color:#1a1a2e}
a.btn{display:inline-block;margin-top:20px;padding:12px 32px;background:#1a1a2e;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px}
a.btn:hover{background:#2a2a4e}
</style>
</head>
<body>
<div class="box">
<div class="check"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg></div>
<h1>Vielen Dank!</h1>
<p>Ihre Anfrage wurde erfolgreich gesendet.</p>
<div class="info">
<b>So geht es weiter:</b><br>
Wir melden uns schnellstm&ouml;glich bei Ihnen &ndash; in der Regel innerhalb von 24 Stunden. Bei dringenden Anliegen erreichen Sie uns telefonisch unter <b>040 / 55 42 10 44</b>.
</div>
<a href="https://www.tischlerei-graupner.de" class="btn">Zur&uuml;ck zur Website</a>
</div>
</body>
</html>""")
        else:
            raise Exception(f"response.php returned {resp.status_code if resp else 'None'}")
            
            return HTMLResponse(content=resp.text, status_code=resp.status_code)
    except Exception as e:
        logger.error(f"Fehler beim Weiterleiten an response.php: {e}")
        return HTMLResponse(content="""
            <html><body style="font-family:sans-serif;text-align:center;padding:40px;">
            <h2>Vielen Dank!</h2>
            <p>Ihre Anfrage wurde erfolgreich gespeichert.</p>
            <p style="color:#888;font-size:14px;">(Die Weiterleitung an das Hauptsystem war vorübergehend nicht möglich. Wir kümmern uns darum.)</p>
            <a href="https://www.tischlerei-graupner.de">Zurück zur Website</a>
            </body></html>
        """)

# ==================== TEMPLATES & SIMILAR DOCS ====================

@api_router.get("/documents/suggestions/{doc_type}")
async def get_document_suggestions(doc_type: str, customer_id: str = "", current_positions: str = "", user=Depends(get_current_user)):
    """Get templates and similar documents for the editor sidebar"""
    collection = "quotes" if doc_type == "quote" else "orders" if doc_type == "order" else "invoices"
    
    all_docs = []
    async for doc in db[collection].find({}, {"_id": 0}):
        all_docs.append(doc)
    
    templates = [d for d in all_docs if d.get("is_template")]
    
    # Score similarity
    current_descs = set(current_positions.lower().split(",")) if current_positions else set()
    similar = []
    for doc in all_docs:
        if doc.get("is_template"):
            continue
        score = 0
        if customer_id and doc.get("customer_id") == customer_id:
            score += 3
        for pos in doc.get("positions", []):
            desc = pos.get("description", "").lower()
            for cd in current_descs:
                if cd.strip() and cd.strip() in desc:
                    score += 2
        if score > 0:
            doc["_similarity_score"] = score
            similar.append(doc)
    
    similar.sort(key=lambda x: x.get("_similarity_score", 0), reverse=True)
    for s in similar:
        s.pop("_similarity_score", None)
    
    return {"templates": templates[:10], "similar": similar[:10]}

@api_router.put("/documents/{doc_type}/{doc_id}/template")
async def toggle_template(doc_type: str, doc_id: str, user=Depends(get_current_user)):
    """Toggle is_template flag on a document"""
    collection = "quotes" if doc_type == "quote" else "orders" if doc_type == "order" else "invoices"
    doc = await db[collection].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    new_val = not doc.get("is_template", False)
    await db[collection].update_one({"id": doc_id}, {"$set": {"is_template": new_val}})
    return {"is_template": new_val}

# ==================== SPEECH TO TEXT ====================

@api_router.post("/speech-to-text")
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

# ==================== AI QUOTE GENERATION ====================

@api_router.post("/ai/generate-quote")
async def generate_quote_with_ai(request: AIQuoteRequest):
    """KI-gestützte Angebotserstellung aus Sprachtranskript"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="API Key nicht konfiguriert")
    
    customer = await db.customers.find_one({"id": request.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    # Artikelstamm laden für Kontext
    articles = await db.articles.find({}, {"_id": 0}).to_list(100)
    articles_context = ""
    if articles:
        articles_context = "\n\nVerfügbare Artikel (Material):\n"
        for a in articles:
            articles_context += f"- {a['name']}: {a['price_net']}€/{a['unit']} - {a.get('description', '')}\n"
    
    # Leistungsstamm laden für Kontext
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
        
        # Parse JSON from response
        import json
        import re
        
        # Try to extract JSON from response
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
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, Response: {response}")
        raise HTTPException(status_code=500, detail="KI-Antwort konnte nicht verarbeitet werden")
    except Exception as e:
        logger.error(f"AI quote generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Fehler bei KI-Angebotserstellung: {str(e)}")

# ==================== PDF GENERATION ====================

def generate_document_pdf(doc_type: str, data: dict, settings: dict) -> BytesIO:
    """Generiert PDF für Angebot, Auftragsbestätigung oder Rechnung"""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Colors
    primary_color = HexColor("#14532D")
    text_color = HexColor("#0F172A")
    muted_color = HexColor("#64748B")
    
    # Header
    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 20)
    
    titles = {
        "quote": "ANGEBOT",
        "order": "AUFTRAGSBESTÄTIGUNG",
        "invoice": "RECHNUNG"
    }
    c.drawString(2*cm, height - 2*cm, titles.get(doc_type, "DOKUMENT"))
    
    # Document number
    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    number_labels = {
        "quote": f"Angebots-Nr.: {data.get('quote_number', '')}",
        "order": f"Auftrags-Nr.: {data.get('order_number', '')}",
        "invoice": f"Rechnungs-Nr.: {data.get('invoice_number', '')}"
    }
    c.drawString(2*cm, height - 2.8*cm, number_labels.get(doc_type, ""))
    c.drawString(2*cm, height - 3.3*cm, f"Datum: {datetime.fromisoformat(data['created_at']).strftime('%d.%m.%Y')}")
    
    # Company info (right side)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - 2*cm, height - 2*cm, settings.get("company_name", "Tischlerei Graupner"))
    c.setFont("Helvetica", 9)
    y_pos = height - 2.5*cm
    if settings.get("address"):
        for line in settings["address"].split("\n"):
            c.drawRightString(width - 2*cm, y_pos, line)
            y_pos -= 0.4*cm
    if settings.get("phone"):
        c.drawRightString(width - 2*cm, y_pos, f"Tel: {settings['phone']}")
        y_pos -= 0.4*cm
    if settings.get("email"):
        c.drawRightString(width - 2*cm, y_pos, settings["email"])
    
    # Customer address
    c.setFillColor(text_color)
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, height - 5*cm, data.get("customer_name", ""))
    y_addr = height - 5.5*cm
    if data.get("customer_address"):
        for line in data["customer_address"].split("\n"):
            c.drawString(2*cm, y_addr, line)
            y_addr -= 0.4*cm
    
    # Positions table
    y_table = height - 8*cm
    c.setFillColor(primary_color)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(2*cm, y_table, "Pos")
    c.drawString(3*cm, y_table, "Beschreibung")
    c.drawString(12*cm, y_table, "Menge")
    c.drawString(14*cm, y_table, "Einheit")
    c.drawString(16*cm, y_table, "Einzelpreis")
    c.drawRightString(width - 2*cm, y_table, "Gesamt")
    
    c.setStrokeColor(HexColor("#E2E8F0"))
    c.line(2*cm, y_table - 0.2*cm, width - 2*cm, y_table - 0.2*cm)
    
    c.setFillColor(text_color)
    c.setFont("Helvetica", 9)
    y_pos = y_table - 0.7*cm
    
    for pos in data.get("positions", []):
        if y_pos < 5*cm:  # New page if needed
            c.showPage()
            y_pos = height - 3*cm
        
        c.drawString(2*cm, y_pos, str(pos.get("pos_nr", "")))
        
        # Wrap description
        desc = pos.get("description", "")
        if len(desc) > 50:
            c.drawString(3*cm, y_pos, desc[:50])
            y_pos -= 0.4*cm
            c.drawString(3*cm, y_pos, desc[50:100])
        else:
            c.drawString(3*cm, y_pos, desc)
        
        c.drawString(12*cm, y_pos, str(pos.get("quantity", 1)))
        c.drawString(14*cm, y_pos, pos.get("unit", "Stück"))
        c.drawRightString(16.5*cm, y_pos, f"{pos.get('price_net', 0):.2f} €")
        total = pos.get("quantity", 1) * pos.get("price_net", 0)
        c.drawRightString(width - 2*cm, y_pos, f"{total:.2f} €")
        y_pos -= 0.6*cm
    
    # Totals
    y_pos -= 0.5*cm
    c.line(12*cm, y_pos, width - 2*cm, y_pos)
    y_pos -= 0.5*cm
    
    c.setFont("Helvetica", 10)
    c.drawString(14*cm, y_pos, "Netto:")
    c.drawRightString(width - 2*cm, y_pos, f"{data.get('subtotal_net', 0):.2f} €")
    y_pos -= 0.5*cm
    
    vat_rate = data.get("vat_rate", 19)
    if vat_rate > 0:
        c.drawString(14*cm, y_pos, f"MwSt ({vat_rate:.0f}%):")
        c.drawRightString(width - 2*cm, y_pos, f"{data.get('vat_amount', 0):.2f} €")
        y_pos -= 0.5*cm
    else:
        c.setFillColor(muted_color)
        c.setFont("Helvetica", 8)
        c.drawString(14*cm, y_pos, "Gemäß §19 UStG wird keine USt berechnet")
        c.setFillColor(text_color)
        c.setFont("Helvetica", 10)
        y_pos -= 0.5*cm
    
    c.setFont("Helvetica-Bold", 11)
    c.drawString(14*cm, y_pos, "Gesamt:")
    c.drawRightString(width - 2*cm, y_pos, f"{data.get('total_gross', 0):.2f} €")
    
    # Notes
    if data.get("notes"):
        y_pos -= 1.5*cm
        c.setFont("Helvetica", 9)
        c.setFillColor(muted_color)
        c.drawString(2*cm, y_pos, "Anmerkungen:")
        c.setFillColor(text_color)
        y_pos -= 0.4*cm
        for line in data["notes"].split("\n")[:5]:
            c.drawString(2*cm, y_pos, line[:80])
            y_pos -= 0.4*cm
    
    # Footer for invoice - bank details
    if doc_type == "invoice" and settings.get("iban"):
        y_pos = 3*cm
        c.setFillColor(muted_color)
        c.setFont("Helvetica", 8)
        c.drawString(2*cm, y_pos, "Bankverbindung:")
        c.setFillColor(text_color)
        c.drawString(5*cm, y_pos, f"{settings.get('bank_name', '')} | IBAN: {settings.get('iban', '')} | BIC: {settings.get('bic', '')}")
        
        if data.get("due_date"):
            due = datetime.fromisoformat(data["due_date"]).strftime('%d.%m.%Y')
            c.drawString(2*cm, y_pos - 0.5*cm, f"Zahlbar bis: {due}")
    
    # Tax ID
    if settings.get("tax_id"):
        c.setFillColor(muted_color)
        c.setFont("Helvetica", 8)
        c.drawString(2*cm, 1.5*cm, f"Steuernummer: {settings['tax_id']}")
    
    c.save()
    buffer.seek(0)
    return buffer

@api_router.get("/pdf/quote/{quote_id}")
async def get_quote_pdf(quote_id: str):
    quote = await db.quotes.find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Angebot nicht gefunden")
    
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    
    pdf_buffer = generate_document_pdf("quote", quote, settings)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Angebot_{quote['quote_number']}.pdf"}
    )

@api_router.get("/pdf/order/{order_id}")
async def get_order_pdf(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    
    pdf_buffer = generate_document_pdf("order", order, settings)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Auftragsbestaetigung_{order['order_number']}.pdf"}
    )

@api_router.get("/pdf/invoice/{invoice_id}")
async def get_invoice_pdf(invoice_id: str):
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
    
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    
    pdf_buffer = generate_document_pdf("invoice", invoice, settings)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Rechnung_{invoice['invoice_number']}.pdf"}
    )

# ==================== EMAIL ====================

@api_router.post("/email/send")
async def send_email(request: EmailRequest):
    """E-Mail mit Dokument-PDF versenden"""
    if not RESEND_API_KEY:
        raise HTTPException(status_code=500, detail="E-Mail nicht konfiguriert. Bitte RESEND_API_KEY in Einstellungen hinterlegen.")
    
    settings = await db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
    
    # Get document
    if request.document_type == "quote":
        doc = await db.quotes.find_one({"id": request.document_id}, {"_id": 0})
        doc_number = doc.get("quote_number", "") if doc else ""
        filename = f"Angebot_{doc_number}.pdf"
        doc_title = "Angebot"
    elif request.document_type == "order":
        doc = await db.orders.find_one({"id": request.document_id}, {"_id": 0})
        doc_number = doc.get("order_number", "") if doc else ""
        filename = f"Auftragsbestaetigung_{doc_number}.pdf"
        doc_title = "Auftragsbestätigung"
    elif request.document_type == "invoice":
        doc = await db.invoices.find_one({"id": request.document_id}, {"_id": 0})
        doc_number = doc.get("invoice_number", "") if doc else ""
        filename = f"Rechnung_{doc_number}.pdf"
        doc_title = "Rechnung"
    else:
        raise HTTPException(status_code=400, detail="Ungültiger Dokumenttyp")
    
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    
    # Generate PDF
    pdf_buffer = generate_document_pdf(request.document_type, doc, settings)
    pdf_base64 = base64.b64encode(pdf_buffer.read()).decode()
    
    company_name = settings.get("company_name", "Tischlerei Graupner")
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #14532D;">{company_name}</h2>
        <p>Sehr geehrte Damen und Herren,</p>
        <p>anbei erhalten Sie {doc_title} Nr. <strong>{doc_number}</strong>.</p>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <br>
        <p>Mit freundlichen Grüßen</p>
        <p><strong>{settings.get('owner_name', company_name)}</strong></p>
        <p style="color: #666; font-size: 12px;">{settings.get('phone', '')}<br>{settings.get('email', '')}</p>
    </body>
    </html>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [request.recipient_email],
        "subject": request.subject,
        "html": html_content,
        "attachments": [
            {
                "filename": filename,
                "content": pdf_base64
            }
        ]
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        return {
            "status": "success",
            "message": f"E-Mail an {request.recipient_email} gesendet",
            "email_id": email.get("id")
        }
    except Exception as e:
        logger.error(f"Email send error: {e}")
        raise HTTPException(status_code=500, detail=f"E-Mail konnte nicht gesendet werden: {str(e)}")

# ==================== DASHBOARD ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Dashboard-Statistiken"""
    quotes = await db.quotes.find({}, {"_id": 0}).to_list(1000)
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    customers = await db.customers.count_documents({})
    
    open_quotes = len([q for q in quotes if q.get("status") == "Entwurf"])
    open_orders = len([o for o in orders if o.get("status") == "Offen"])
    unpaid_invoices = len([i for i in invoices if i.get("status") == "Offen"])
    
    total_quotes_value = sum(q.get("total_gross", 0) for q in quotes)
    total_invoices_value = sum(i.get("total_gross", 0) for i in invoices)
    paid_invoices_value = sum(i.get("total_gross", 0) for i in invoices if i.get("status") == "Bezahlt")
    
    return {
        "customers_count": customers,
        "quotes": {
            "total": len(quotes),
            "open": open_quotes,
            "total_value": round(total_quotes_value, 2)
        },
        "orders": {
            "total": len(orders),
            "open": open_orders
        },
        "invoices": {
            "total": len(invoices),
            "unpaid": unpaid_invoices,
            "total_value": round(total_invoices_value, 2),
            "paid_value": round(paid_invoices_value, 2)
        }
    }

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Graupner Suite API", "version": "1.0.0"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
