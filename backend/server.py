from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
from database import client, logger

# Import all route modules
from routes.auth import router as auth_router
from routes.customers import router as customers_router
from routes.articles import router as articles_router
from routes.services import router as services_router
from routes.quotes import router as quotes_router
from routes.orders import router as orders_router
from routes.invoices import router as invoices_router
from routes.email import router as email_router
from routes.settings import router as settings_router
from routes.push import router as push_router
from routes.webhook import router as webhook_router
from routes.documents import router as documents_router
from routes.distance import router as distance_router
from routes.ai import router as ai_router
from routes.pdf import router as pdf_router
from routes.dashboard import router as dashboard_router
from routes.text_templates import router as text_templates_router
from routes.leistungsbloecke import router as leistungsbloecke_router
from routes.portal import router as portal_router
from routes.einsaetze import router as einsaetze_router
from routes.imap import router as imap_router
from routes.kalkulation import router as kalkulation_router
from routes.buchhaltung import router as buchhaltung_router

# Create the main app
app = FastAPI(title="Graupner Suite API")
api_router = APIRouter(prefix="/api")

# Include all route modules
api_router.include_router(auth_router)
api_router.include_router(customers_router)
api_router.include_router(articles_router)
api_router.include_router(services_router)
api_router.include_router(quotes_router)
api_router.include_router(orders_router)
api_router.include_router(invoices_router)
api_router.include_router(email_router)
api_router.include_router(settings_router)
api_router.include_router(push_router)
api_router.include_router(webhook_router)
api_router.include_router(documents_router)
api_router.include_router(distance_router)
api_router.include_router(ai_router)
api_router.include_router(pdf_router)
api_router.include_router(dashboard_router)
api_router.include_router(text_templates_router)
api_router.include_router(leistungsbloecke_router)
api_router.include_router(portal_router)
api_router.include_router(einsaetze_router)
api_router.include_router(imap_router)
api_router.include_router(kalkulation_router)
api_router.include_router(buchhaltung_router)


@api_router.get("/")
async def root():
    return {"message": "Graupner Suite API", "version": "2.0.0"}


# Include router and middleware
app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    try:
        from utils.storage import init_storage
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init: {e}")
    # Start IMAP polling background task
    import asyncio
    asyncio.create_task(imap_polling_loop())


async def imap_polling_loop():
    """Background task: poll IMAP every 30 minutes"""
    import asyncio
    from database import db as _db
    while True:
        try:
            await asyncio.sleep(1800)  # 30 minutes
            settings = await _db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
            if not settings.get("imap_enabled"):
                continue
            from routes.imap import fetch_imap_emails_internal
            count = await fetch_imap_emails_internal(settings)
            if count > 0:
                logger.info(f"IMAP auto-poll: {count} neue E-Mails abgerufen")
        except Exception as e:
            logger.warning(f"IMAP polling error: {e}")
            await asyncio.sleep(60)

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
