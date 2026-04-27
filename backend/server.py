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
from routes.portal_klon import router as portal_klon_router
from routes.einsaetze import router as einsaetze_router
from routes.document_templates import router as document_templates_router
from routes.imap import router as imap_router
from routes.kalkulation import router as kalkulation_router
from routes.buchhaltung import router as buchhaltung_router
from routes.mitarbeiter import router as mitarbeiter_router
from routes.diverses import router as diverses_router
from routes.backup import router as backup_router
from routes.auto_backup import router as auto_backup_router
from routes.anfragen import router as anfragen_router
from routes.anfragen_fetcher import router as anfragen_fetcher_router
from routes.documents_manager import router as documents_manager_router
from routes.modules import router as modules_router
from routes.module_artikel import router as module_artikel_router
from routes.module_dokumente import router as module_dokumente_router
from routes.module_textvorlagen import router as module_textvorlagen_router
from routes.module_kunden import router as module_kunden_router
from routes.rechnungen_v2 import router as rechnungen_v2_router
from portal_v2 import router as portal_v2_router
from portal_v3 import router as portal_v3_router
from portal_v4 import router as portal_v4_router
from monteur_app import router as monteur_app_router
from module_duplikate import router as module_duplikate_router
from module_projekte import router as module_projekte_router
from module_aufgaben.routes import router as module_aufgaben_router
from module_termine.routes import router as module_termine_router
from module_kalender_export.routes import router as module_kalender_export_router
from module_user_prefs.routes import router as module_user_prefs_router
from module_portal_v2_backup import router as module_portal_v2_backup_router
from module_portal_v2_backup.routes import start_auto_backup_task
from dokumente_v2 import router as dokumente_v2_router

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
api_router.include_router(portal_klon_router)  # Kundenportale Arbeitskopie (Klon von /portals)
api_router.include_router(einsaetze_router)
api_router.include_router(document_templates_router)
api_router.include_router(imap_router)
api_router.include_router(kalkulation_router)
api_router.include_router(buchhaltung_router)
api_router.include_router(mitarbeiter_router)
api_router.include_router(diverses_router)
api_router.include_router(backup_router)
api_router.include_router(auto_backup_router)
api_router.include_router(anfragen_router)
api_router.include_router(anfragen_fetcher_router)
api_router.include_router(documents_manager_router)
api_router.include_router(modules_router)
api_router.include_router(module_artikel_router)
api_router.include_router(module_dokumente_router)
api_router.include_router(module_textvorlagen_router)
api_router.include_router(module_kunden_router)


@api_router.get("/")
async def root():
    return {"message": "Graupner Suite API", "version": "2.0.0"}


# Include router and middleware
app.include_router(api_router)
app.include_router(rechnungen_v2_router)  # v2-Modul mit eigenem prefix /api/v2
app.include_router(portal_v2_router)  # Kundenportal v2 – Modul-First, prefix /api/portal-v2
app.include_router(portal_v3_router)  # Kundenportal v3 (Test/Performance-Sandbox), prefix /api/portal-v3
app.include_router(portal_v4_router)  # Kundenportal v4 (Dokumente-Anbindung-Sandbox), prefix /api/portal-v4
app.include_router(monteur_app_router)  # Monteur-App (mobile), prefix /api/monteur
app.include_router(dokumente_v2_router)  # Dokumente v2 – Modul-First, prefix /api/dokumente-v2
app.include_router(module_duplikate_router)  # Duplikate-Erkennung & Merge, prefix /api/module-duplikate
app.include_router(module_projekte_router)   # Projekte (Akten/Vorgaenge), prefix /api/module-projekte
app.include_router(module_aufgaben_router, prefix="/api/module-aufgaben", tags=["Aufgaben"])  # Interne Aufgaben (Auto, Werkzeug, Lager)
app.include_router(module_termine_router, prefix="/api/module-termine", tags=["Termine"])  # Termine mit GO-Workflow & Datenmaske
app.include_router(module_kalender_export_router, prefix="/api/module-kalender-export", tags=["Kalender-Export"])  # ICS-Mail + Monteur-Feed
app.include_router(module_user_prefs_router, prefix="/api/module-user-prefs", tags=["UserPrefs"])  # UI-Präferenzen pro User
app.include_router(module_portal_v2_backup_router)  # Portal-v2-Sicherungen, prefix /api/module-portal-v2-backup

@app.on_event("startup")
async def startup_event():
    try:
        from utils.storage import init_storage
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init: {e}")
    # Migrate module_kontakt -> module_kunden (einmalig)
    await migrate_kontakt_to_kunden()
    # Auto-Sync kontakt_status & legacy status (einmalig beim Start, idempotent)
    try:
        from routes.module_kunden import auto_sync_kontakt_status_on_startup
        await auto_sync_kontakt_status_on_startup()
    except Exception as e:
        logger.warning(f"Auto-Sync kontakt_status import: {e}")
    # Portal-v2-Backup: taeglicher Auto-Snapshot (Background-Task)
    try:
        start_auto_backup_task()
    except Exception as e:
        logger.warning(f"Portal-v2-Backup Auto-Task: {e}")
    # IMAP polling background task - TEMPORAERE DEAKTIVIERT (User-Wunsch)
    # Um wieder zu aktivieren: naechste Zeile einkommentieren
    import asyncio
    # asyncio.create_task(imap_polling_loop())  # DEAKTIVIERT
    logger.info("IMAP-Polling DEAKTIVIERT (manuell per Code)")
    # Start automatic daily backup task
    asyncio.create_task(daily_backup_loop())


async def migrate_kontakt_to_kunden():
    """Migriert alte module_kontakt Daten nach module_kunden (einmalig)"""
    from database import db as _db
    try:
        kontakte = await _db.module_kontakt.find({}, {"_id": 0}).to_list(10000)
        if not kontakte:
            return
        migrated = 0
        for k in kontakte:
            email = k.get("email", "")
            existing = None
            if email:
                existing = await _db.module_kunden.find_one({"email": email})
            if not existing:
                k["status"] = k.get("kontakt_status", "Anfrage")
                await _db.module_kunden.insert_one(k)
                migrated += 1
        if migrated > 0:
            logger.info(f"Migration: {migrated} Kontakte nach Kunden uebernommen")
    except Exception as e:
        logger.warning(f"Migration Kontakt->Kunden: {e}")


async def imap_polling_loop():
    """Background task: poll IMAP at configurable interval"""
    import asyncio
    from database import db as _db
    while True:
        try:
            settings = await _db.settings.find_one({"id": "company_settings"}, {"_id": 0}) or {}
            
            # Konfigurierbare Intervall (in Minuten, Standard: 30)
            interval_minutes = settings.get("imap_polling_interval", 30)
            interval_seconds = interval_minutes * 60
            
            await asyncio.sleep(interval_seconds)
            
            if not settings.get("imap_enabled"):
                continue
            from routes.imap import fetch_imap_emails_internal
            count = await fetch_imap_emails_internal(settings)
            if count > 0:
                logger.info(f"IMAP auto-poll ({interval_minutes} Min): {count} neue E-Mails abgerufen")
        except Exception as e:
            logger.warning(f"IMAP polling error: {e}")
            await asyncio.sleep(60)


async def daily_backup_loop():
    """Background task: daily backup at 2 AM"""
    from routes.auto_backup import daily_backup_task
    await daily_backup_task()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "*",  # Temporarily allow all for development
        "https://anfrage.schiebetür-reparatur-hamburg.de",  # IONOS Subdomain
        "https://anfrage.xn--schiebetr-reparatur-hamburg-fic.de",  # IONOS Subdomain (IDN encoded)
        "https://handwerk-deploy.preview.emergentagent.com",  # Preview URL
        "https://code-import-flow-1.emergent.host",  # Final Deployment URL
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
