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


@api_router.get("/")
async def root():
    return {"message": "Graupner Suite API", "version": "2.0.0"}


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
