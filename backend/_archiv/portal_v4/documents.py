"""
Portal v4 – Dokumente-Anbindung (Sandbox, 23.04.2026)

LESEND auf dokumente_v2 Collection:
- Filter nach account.kunde_id (identisch mit dokumente_v2.kunde_id)
- Filter nach portal_v4_freigegeben=True (Admin muss explizit freigeben)
- Nur Basis-Metadaten + PDF-Download

KEIN Zugriff auf andere Kunden-Dokumente – strenge Isolation.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import io

from database import db, logger
from .auth import get_current_customer
from dokumente_v2.pdf import generate_pdf

router = APIRouter(prefix="/documents")


# Projektion: was der Kunde zu seinen Dokumenten sehen darf
CUSTOMER_FIELDS = {
    "_id": 0,
    "id": 1, "type": 1, "nummer": 1, "status": 1, "betreff": 1,
    "netto": 1, "mwst": 1, "brutto": 1,
    "created_at": 1, "issued_at": 1,
    "portal_v4_freigegeben": 1, "portal_v4_freigegeben_at": 1,
}


def _build_filter(account: dict) -> dict:
    """Zentrale Zugriffs-Regel: nur freigegebene Dokumente des eingeloggten Kunden."""
    # portal4_accounts.customer_id referenziert module_kunden.id (identisch mit dokumente_v2.kunde_id)
    customer_id = account.get("customer_id")
    if not customer_id:
        # Ohne customer_id (z.B. direkt angelegte Test-Accounts) sieht er nichts
        return {"__never_match__": True}
    return {
        "kunde_id": customer_id,
        "portal_v4_freigegeben": True,
    }


@router.get("")
async def list_my_documents(account=Depends(get_current_customer)):
    """Liste aller fuer diesen Kunden freigegebenen Dokumente."""
    q = _build_filter(account)
    docs = await db.dokumente_v2.find(q, CUSTOMER_FIELDS).sort("created_at", -1).to_list(500)
    return docs


@router.get("/{doc_id}")
async def get_my_document(doc_id: str, account=Depends(get_current_customer)):
    q = {**_build_filter(account), "id": doc_id}
    doc = await db.dokumente_v2.find_one(q, CUSTOMER_FIELDS)
    if not doc:
        # Absichtlich 404 auch bei fehlender Freigabe (keine Info leaken ob Dokument existiert)
        raise HTTPException(404, "Nicht gefunden oder nicht freigegeben")
    return doc


@router.get("/{doc_id}/pdf")
async def pdf_my_document(doc_id: str, account=Depends(get_current_customer)):
    # Zuerst Berechtigung pruefen (mit projizierten Feldern)
    q = {**_build_filter(account), "id": doc_id}
    allowed = await db.dokumente_v2.find_one(q, {"_id": 0, "id": 1})
    if not allowed:
        raise HTTPException(404, "Nicht gefunden oder nicht freigegeben")
    # Full doc fuer PDF-Generation laden
    full = await db.dokumente_v2.find_one({"id": doc_id}, {"_id": 0})
    pdf_bytes = await generate_pdf(full)
    filename = f"{full.get('type', 'dokument')}_{full.get('nummer') or 'entwurf'}.pdf"
    logger.info(f"Portal v4: Kunde {account.get('id')} hat PDF {doc_id} geladen")
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
