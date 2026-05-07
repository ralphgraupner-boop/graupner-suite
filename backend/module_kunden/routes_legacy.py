from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from typing import List, Optional
from models import Customer, CustomerCreate, Anfrage
from database import db, logger, CATEGORIES
from auth import get_current_user
import re

router = APIRouter()


def parse_vcf_customer(content: str) -> dict:
    """Parse a VCF/vCard file content into a customer dictionary"""
    data = {"name": "", "vorname": "", "nachname": "", "email": "", "phone": "", "address": "", "anrede": "",
            "firma": "", "notes": "", "customer_type": "Privat"}

    lines = content.replace("\r\n ", "").replace("\r\n\t", "").split("\r\n")
    if len(lines) <= 1:
        lines = content.replace("\n ", "").replace("\n\t", "").split("\n")

    for line in lines:
        line = line.strip()
        if not line or line in ("BEGIN:VCARD", "END:VCARD"):
            continue

        if line.startswith("N:") or line.startswith("N;"):
            parts = line.split(":", 1)[1].split(";")
            family = parts[0] if len(parts) > 0 else ""
            given = parts[1] if len(parts) > 1 else ""
            prefix = parts[3] if len(parts) > 3 else ""
            if prefix in ("Herr", "Frau"):
                data["anrede"] = prefix
            data["vorname"] = given.strip()
            data["nachname"] = family.strip()
            data["name"] = f"{given} {family}".strip()

        elif line.startswith("FN:") or line.startswith("FN;"):
            fn = line.split(":", 1)[1].strip()
            if not data["name"]:
                data["name"] = fn

        elif line.startswith("EMAIL"):
            data["email"] = line.split(":", 1)[1].strip()

        elif line.startswith("TEL"):
            tel = line.split(":", 1)[1].strip()
            if tel:
                if "mobile" in line.lower():
                    data["phone"] = tel
                elif not data["phone"]:
                    data["phone"] = tel

        elif line.startswith("ADR"):
            parts = line.split(":", 1)[1].split(";")
            street = parts[2] if len(parts) > 2 else ""
            city = parts[3] if len(parts) > 3 else ""
            plz = parts[5] if len(parts) > 5 else ""
            country = parts[6] if len(parts) > 6 else ""
            addr_parts = [p for p in [street, f"{plz} {city}".strip(), country] if p]
            data["address"] = ", ".join(addr_parts)

        elif line.startswith("ORG:"):
            org = line.split(":", 1)[1].strip()
            if org and org not in ("Herr", "Frau", "Divers"):
                data["firma"] = org

        elif line.startswith("ROLE:"):
            data["notes"] = line.split(":", 1)[1].strip()

        elif line.startswith("CATEGORIES:"):
            cat_val = line.split(":", 1)[1].strip()
            if cat_val.lower() in ("privat", "private"):
                data["customer_type"] = "Privat"
            elif cat_val.lower() in ("firma", "business", "work"):
                data["customer_type"] = "Firma"

    return data


@router.post("/customers/import-vcf")
async def import_vcf_customer(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import a VCF/vCard file as a new Customer"""
    if not file.filename.lower().endswith(".vcf"):
        raise HTTPException(status_code=400, detail="Nur .vcf Dateien erlaubt")

    content = (await file.read()).decode("utf-8", errors="ignore")
    data = parse_vcf_customer(content)

    if not data.get("vorname") and not data.get("nachname") and not data["name"]:
        raise HTTPException(status_code=400, detail="Kein Name in der VCF-Datei gefunden")

    customer = Customer(
        name=data["name"],
        vorname=data["vorname"],
        nachname=data["nachname"],
        email=data["email"],
        phone=data["phone"],
        address=data["address"],
        anrede=data["anrede"],
        firma=data["firma"],
        notes=data["notes"],
        customer_type=data["customer_type"],
    )
    await db.customers.insert_one(customer.model_dump())
    result = customer.model_dump()
    result.pop("_id", None)
    logger.info(f"VCF-Import Kunde: {data['vorname']} {data['nachname']}")
    return result


@router.get("/customers", response_model=List[Customer])
async def get_customers():
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    return customers


@router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return customer


@router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate):
    # Generate combined name from vorname + nachname if not provided
    if not customer.name and (customer.vorname or customer.nachname):
        customer.name = f"{customer.vorname} {customer.nachname}".strip()
    elif not customer.name:
        customer.name = "Unbekannt"
    
    customer_obj = Customer(**customer.model_dump())
    await db.customers.insert_one(customer_obj.model_dump())
    return customer_obj


@router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer: CustomerCreate):
    existing = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    # Generate combined name from vorname + nachname if not provided
    update_data = customer.model_dump()
    if not update_data.get("name") and (update_data.get("vorname") or update_data.get("nachname")):
        update_data["name"] = f"{update_data.get('vorname', '')} {update_data.get('nachname', '')}".strip()
    
    updated = {**existing, **update_data}
    await db.customers.update_one({"id": customer_id}, {"$set": updated})
    return updated


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    return {"message": "Kunde gelöscht"}


@router.post("/customers/{customer_id}/to-anfrage")
async def customer_to_anfrage(customer_id: str, user=Depends(get_current_user)):
    """Kunde zurück in Anfrage umwandeln"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")

    anfrage = Anfrage(
        name=customer.get("name", ""),
        email=customer.get("email", ""),
        phone=customer.get("phone", ""),
        address=customer.get("address", ""),
        notes=customer.get("notes", ""),
        photos=customer.get("photos", []),
        categories=customer.get("categories", []),
        customer_type=customer.get("customer_type", "Privat"),
        source="rueckstufung"
    )
    await db.anfragen.insert_one(anfrage.model_dump())
    await db.customers.delete_one({"id": customer_id})

    return {"message": "Kunde zurück in Anfrage umgewandelt", "anfrage_id": anfrage.id}


@router.post("/customers/{customer_id}/upload")
async def upload_customer_files(
    customer_id: str,
    files: List[UploadFile] = File(...),
    user=Depends(get_current_user)
):
    """Upload files for a customer (max 10 files, 10MB each)"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    MAX_FILES = 10
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB
    
    current_files = customer.get("photos", [])
    if len(current_files) + len(files) > MAX_FILES:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximale Anzahl Dateien überschritten (max {MAX_FILES})"
        )
    
    uploaded_urls = []
    
    try:
        from utils.storage import put_object
        import uuid as _uuid
        
        for file in files:
            # Read file content
            content = await file.read()
            
            # Check file size
            if len(content) > MAX_SIZE:
                raise HTTPException(
                    status_code=400,
                    detail=f"Datei {file.filename} ist zu groß (max 10 MB)"
                )
            
            # Generate safe filename
            safe_name = file.filename.replace(" ", "_") if file.filename else "datei"
            storage_path = f"customers/{customer_id}/{_uuid.uuid4().hex[:8]}_{safe_name}"
            
            # Upload to object storage
            result = put_object(storage_path, content, file.content_type or "application/octet-stream")
            
            if result and result.get("url"):
                uploaded_urls.append({
                    "url": result["url"],
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "size": len(content)
                })
                logger.info(f"Datei für Kunde {customer_id} gespeichert: {storage_path}")
            elif result and result.get("path"):
                uploaded_urls.append({
                    "url": result["path"],
                    "filename": file.filename,
                    "content_type": file.content_type,
                    "size": len(content)
                })
                logger.info(f"Datei für Kunde {customer_id} gespeichert: {storage_path}")
    
    except Exception as e:
        logger.error(f"Fehler beim Upload für Kunde {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload-Fehler: {str(e)}")
    
    # Update customer with new files
    all_files = current_files + uploaded_urls
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"photos": all_files}}
    )
    
    return {
        "message": f"{len(uploaded_urls)} Datei(en) hochgeladen",
        "uploaded": uploaded_urls,
        "total_files": len(all_files)
    }


@router.delete("/customers/{customer_id}/files/{file_index}")
async def delete_customer_file(
    customer_id: str,
    file_index: int,
    user=Depends(get_current_user)
):
    """Delete a file from customer"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden")
    
    files = customer.get("photos", [])
    if file_index < 0 or file_index >= len(files):
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    
    # Remove file from list
    files.pop(file_index)
    
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"photos": files}}
    )
    
    return {"message": "Datei gelöscht", "remaining_files": len(files)}
