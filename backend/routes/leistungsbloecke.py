from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models import LeistungsBlock, LeistungsBlockCreate
from database import db
from security.admin_check import require_admin

router = APIRouter()


@router.get("/leistungsbloecke")
async def get_blocks():
    blocks = await db.leistungsbloecke.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return blocks


@router.post("/leistungsbloecke", dependencies=[Depends(require_admin)])
async def create_block(block: LeistungsBlockCreate):
    block_obj = LeistungsBlock(name=block.name, positions=block.positions)
    await db.leistungsbloecke.insert_one(block_obj.model_dump())
    return block_obj.model_dump()


@router.delete("/leistungsbloecke/{block_id}", dependencies=[Depends(require_admin)])
async def delete_block(block_id: str):
    result = await db.leistungsbloecke.delete_one({"id": block_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block nicht gefunden")
    return {"message": "Block gelöscht"}
