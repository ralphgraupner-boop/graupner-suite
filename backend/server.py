from fastapi import FastAPI, APIRouter, Depends
from starlette.middleware.cors import CORSMiddleware
from database import client, logger

# ============================================================
# ROUTING-ÜBERSICHT
# ============================================================
# module_*/ = eigenständige Module (Modul-First-Architektur)
#             haben eigene Collection, eigenen Router, eigene Tests
#
# routes/   = Querschnitts-Dienste (kein eigenes Modul)
#   auth.py           – JWT-Login/Logout
#   settings.py       – Firmeneinstellungen
#   backup.py         – Datenbank-Export/Import
#   auto_backup.py    – täglicher Backup-Task
#   email.py          – ausgehende E-Mails (SMTP)
#   imap.py           – IMAP-Konten verwalten
#   dashboard.py      – Startseite-Daten
#   ai.py             – KI-Funktionen
#   pdf.py            – PDF-Generierung
#   push.py           – Push-Benachrichtigungen
#   webhook.py        – eingehende Webhooks
#   distance.py       – Entfernungsberechnung
#   mitarbeiter.py    – Mitarbeiterverwaltung
#   articles.py       – Artikel/Leistungen
#   services.py       – Dienstleistungen
#   kalkulation.py    – Kalkulations-Tool
#   anfragen.py       – Kundenanfragen (legacy)
#   anfragen_fetcher.py – Anfragen-Abruf
#   leistungsbloecke.py – Leistungsblöcke
#   text_templates.py – Textvorlagen (legacy, → module_textvorlagen)
#   diverses.py       – Diverses/Sonstiges
#   modules.py        – Modul-Registry
# ============================================================

# Import all route modules
from routes.auth import router as auth_router
from module_kunden import router as kunden_router  # Modul-First (07.05.2026)
from routes.articles import router as articles_router
from routes.services import router as services_router
from module_angebote import router as quotes_router  # Modul-First (07.05.2026)
from module_auftraege import router as orders_router
from module_rechnungen import router_v1 as invoices_router
from routes.email import router as email_router
from routes.settings import router as settings_router
from routes.push import router as push_router
from routes.webhook import router as webhook_router
from module_dokumente import router as documents_router  # Modul-First (07.05.2026)
from routes.distance import router as distance_router
from routes.ai import router as ai_router
from routes.pdf import router as pdf_router
from routes.eml_export import router as eml_router
from routes.dashboard import router as dashboard_router
from routes.text_templates import router as text_templates_router
from routes.leistungsbloecke import router as leistungsbloecke_router
from module_kundenportal import router as portal_router  # Modul-First (07.05.2026)
# routes.portal_klon ist Teil von module_kundenportal; eigener Eintrag entfaellt.
from module_einsaetze import router as einsaetze_router  # Modul-First (07.05.2026)
# document_templates ist in module_dokumente integriert; eigener Eintrag entfaellt.
from routes.imap import router as imap_router
from routes.kalkulation import router as kalkulation_router
from module_buchhaltung import router as buchhaltung_router  # Modul-First (07.05.2026)
from routes.mitarbeiter import router as mitarbeiter_router
from routes.diverses import router as diverses_router
from routes.backup import router as backup_router
from routes.auto_backup import router as auto_backup_router
from routes.admin_migrations import router as admin_migrations_router
from routes.anfragen import router as anfragen_router
from routes.anfragen_fetcher import router as anfragen_fetcher_router
# documents_manager ist in module_dokumente integriert; eigener Eintrag entfaellt.
from routes.modules import router as modules_router
from module_artikel import router as module_artikel_router  # Modul-First (07.05.2026)
# routes.module_dokumente ist Teil von module_dokumente; eigener Eintrag entfaellt.
from module_textvorlagen import router as module_textvorlagen_router  # Modul-First (07.05.2026)
from module_voice_intake import router as voice_intake_router  # Modul-First (07.05.2026)
# kunden_router ist oben bereits aus module_kunden importiert — alter
# routes.module_kunden Import wurde im Refactor entfernt.
from module_rechnungen import router_v2 as rechnungen_v2_router  # Modul-First (07.05.2026)
from monteur_app import router as monteur_app_router
from module_duplikate import router as module_duplikate_router
from module_projekte import router as module_projekte_router
from module_aufgaben.routes import router as module_aufgaben_router
from module_termine.routes import router as module_termine_router
from module_kalender_export.routes import router as module_kalender_export_router
from module_user_prefs.routes import router as module_user_prefs_router
from module_export.routes import router as module_export_router
from module_health import router as module_health_router
from module_kunde_delete import router as module_kunde_delete_router
from module_papierkorb import router as module_papierkorb_router
from module_benachrichtigungen import router as module_benachrichtigungen_router
from module_wolke.routes import router as module_wolke_router
from module_mail_inbox import router as module_mail_inbox_router
from module_feedback import router as module_feedback_router
from module_assistent import router as module_assistent_router
from module_kundenlink.routes import router as module_kundenlink_router
from module_textkorrektur import router as module_textkorrektur_router
from module_portal_v2_backup import router as module_portal_v2_backup_router
from module_portal_v2_backup.routes import start_auto_backup_task
from dokumente_v2 import router as dokumente_v2_router
from security.admin_check import require_finanz, require_admin  # Rollenschutz (admin/buchhaltung bzw. admin)
from routes.auth import get_current_user  # Login-Pflicht fuer interne Endpunkte

# Create the main app
app = FastAPI(title="Graupner Suite API")
api_router = APIRouter(prefix="/api")

# Include all route modules
api_router.include_router(auth_router)
api_router.include_router(kunden_router, dependencies=[Depends(get_current_user)])
api_router.include_router(articles_router, dependencies=[Depends(get_current_user)])
api_router.include_router(services_router, dependencies=[Depends(get_current_user)])
api_router.include_router(quotes_router, dependencies=[Depends(require_finanz)])
api_router.include_router(orders_router, dependencies=[Depends(require_finanz)])
api_router.include_router(invoices_router, dependencies=[Depends(require_finanz)])
api_router.include_router(email_router)
api_router.include_router(settings_router, dependencies=[Depends(get_current_user)])
api_router.include_router(push_router)
api_router.include_router(webhook_router)
api_router.include_router(documents_router, dependencies=[Depends(get_current_user)])
api_router.include_router(distance_router)
api_router.include_router(ai_router, dependencies=[Depends(get_current_user)])
api_router.include_router(pdf_router, dependencies=[Depends(require_finanz)])
api_router.include_router(eml_router, dependencies=[Depends(require_finanz)])
api_router.include_router(dashboard_router)
api_router.include_router(text_templates_router)
api_router.include_router(leistungsbloecke_router, dependencies=[Depends(get_current_user)])
api_router.include_router(portal_router)
# portal_klon ist Teil von module_kundenportal (oben eingehaengt)
api_router.include_router(einsaetze_router)
# document_templates ist Teil von module_dokumente
api_router.include_router(imap_router)
api_router.include_router(kalkulation_router, dependencies=[Depends(get_current_user)])
api_router.include_router(buchhaltung_router)
api_router.include_router(mitarbeiter_router)
api_router.include_router(diverses_router)
api_router.include_router(backup_router)
api_router.include_router(auto_backup_router, dependencies=[Depends(require_admin)])
api_router.include_router(admin_migrations_router)
api_router.include_router(anfragen_router, dependencies=[Depends(get_current_user)])
api_router.include_router(anfragen_fetcher_router)
# documents_manager ist Teil von module_dokumente
api_router.include_router(modules_router)
api_router.include_router(module_artikel_router, dependencies=[Depends(get_current_user)])
# module_dokumente_data ist Teil von module_dokumente
api_router.include_router(module_textvorlagen_router)
api_router.include_router(voice_intake_router)
# kunden_router wurde bereits weiter oben (Zeile ~71) eingehaengt


@api_router.get("/")
async def root():
    return {"message": "Graupner Suite API", "version": "2.0.0"}


# Include router and middleware
app.include_router(api_router)
app.include_router(rechnungen_v2_router)  # v2-Modul mit eigenem prefix /api/v2
app.include_router(monteur_app_router)  # Monteur-App (mobile), prefix /api/monteur
app.include_router(dokumente_v2_router)  # Dokumente v2 – Modul-First, prefix /api/dokumente-v2
app.include_router(module_duplikate_router)  # Duplikate-Erkennung & Merge, prefix /api/module-duplikate
app.include_router(module_projekte_router)   # Projekte (Akten/Vorgaenge), prefix /api/module-projekte
app.include_router(module_aufgaben_router, prefix="/api/module-aufgaben", tags=["Aufgaben"])  # Interne Aufgaben (Auto, Werkzeug, Lager)
app.include_router(module_termine_router, prefix="/api/module-termine", tags=["Termine"])  # Termine mit GO-Workflow & Datenmaske
app.include_router(module_kalender_export_router, prefix="/api/module-kalender-export", tags=["Kalender-Export"])  # ICS-Mail + Monteur-Feed
app.include_router(module_user_prefs_router, prefix="/api/module-user-prefs", tags=["UserPrefs"])  # UI-Präferenzen pro User
app.include_router(module_export_router, prefix="/api/module-export", tags=["Export"])  # Kunden-Export/Import als ZIP
app.include_router(module_health_router, prefix="/api/module-health", tags=["Health"])  # Status/Version/Umgebungs-Check
app.include_router(module_kunde_delete_router, prefix="/api/module-kunde-delete", tags=["KundeDelete"])  # Cascade-Delete mit Vorab-Export
app.include_router(module_papierkorb_router, prefix="/api/module-papierkorb", tags=["Papierkorb"])  # Soft-Delete + Restore + Purge
app.include_router(module_benachrichtigungen_router, prefix="/api/module-benachrichtigungen", tags=["Benachrichtigungen"])  # Popup- und Meldungs-Steuerung pro User
app.include_router(module_wolke_router, prefix="/api/module-wolke", tags=["Wolke"])  # Interne Kurz-Kommunikation (Memos + Aufgaben)
app.include_router(module_mail_inbox_router, prefix="/api/module-mail-inbox", tags=["MailInbox"])  # Jimdo-Anfragen → Kundenvorschlag
app.include_router(module_feedback_router, prefix="/api/module-feedback", tags=["Feedback"])  # Persönliche Notizen/Bugs/Ideen
app.include_router(module_assistent_router, prefix="/api/module-assistent", tags=["Assistent"])  # Stiller Beobachter für Ralph
app.include_router(module_kundenlink_router, prefix="/api/module-kundenlink", tags=["KundenLink"])  # Öffentl. Link an Mitarbeiter (Probezeit)
app.include_router(module_textkorrektur_router, prefix="/api/module-textkorrektur", tags=["Textkorrektur"])  # KI-Rechtschreib-/Grammatik-Korrektur
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
        from module_kunden import auto_sync_kontakt_status_on_startup
        await auto_sync_kontakt_status_on_startup()
    except Exception as e:
        logger.warning(f"Auto-Sync kontakt_status import: {e}")
    # §35a Lohnanteil-Textvorlage seeden (idempotent)
    try:
        from module_textvorlagen.lohnanteil_helper import ensure_lohnanteil_template_seeded
        await ensure_lohnanteil_template_seeded()
    except Exception as e:
        logger.warning(f"Lohnanteil-Seed import: {e}")
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
    # Wolke Push-Retry Scheduler (5 Min Intervall, 10 Versuche — siehe module_wolke/retry_scheduler.py)
    try:
        from module_wolke.retry_scheduler import wolke_retry_loop
        asyncio.create_task(wolke_retry_loop())
    except Exception as e:
        logger.warning(f"Wolke-Retry-Scheduler konnte nicht gestartet werden: {e}")
    # Assistent: täglicher Check-Lauf um 06:00 UTC
    try:
        from module_assistent.scheduler import assistent_daily_task
        asyncio.create_task(assistent_daily_task())
        logger.info("Assistent-Scheduler gestartet (täglich 06:00 UTC)")
    except Exception as e:
        logger.warning(f"Assistent-Scheduler konnte nicht gestartet werden: {e}")


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
        "https://tischlerei-suite.preview.emergentagent.com",  # Preview URL
        "https://code-import-flow-1.emergent.host",  # Final Deployment URL
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
