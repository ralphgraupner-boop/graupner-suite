from fastapi import APIRouter, HTTPException, Depends
from database import db, logger
from auth import get_current_user

router = APIRouter()


@router.get("/documents/suggestions/{doc_type}")
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


@router.put("/documents/{doc_type}/{doc_id}/template")
async def toggle_template(doc_type: str, doc_id: str, user=Depends(get_current_user)):
    """Toggle is_template flag on a document"""
    collection = "quotes" if doc_type == "quote" else "orders" if doc_type == "order" else "invoices"
    doc = await db[collection].find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Dokument nicht gefunden")
    new_val = not doc.get("is_template", False)
    await db[collection].update_one({"id": doc_id}, {"$set": {"is_template": new_val}})
    return {"is_template": new_val}
