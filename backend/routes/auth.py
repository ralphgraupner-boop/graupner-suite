from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import jwt
import bcrypt
from models import UserLogin, UserCreate, TokenResponse
from database import db, JWT_SECRET
from auth import get_current_user

router = APIRouter()


@router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"username": user.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Benutzer existiert bereits")

    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()

    user_doc = {
        "username": user.username,
        "password": hashed,
        "email": user.email,
        "role": user.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    token = jwt.encode(
        {"username": user.username, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30},
        JWT_SECRET,
        algorithm="HS256"
    )
    return TokenResponse(token=token, username=user.username, role=user.role)


@router.post("/auth/login", response_model=TokenResponse)
async def login(user: UserLogin):
    db_user = await db.users.find_one({"username": user.username}, {"_id": 0})
    if not db_user:
        # Auto-create admin if no users exist
        count = await db.users.count_documents({})
        if count == 0 and user.username == "admin":
            hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
            await db.users.insert_one({
                "username": "admin",
                "password": hashed,
                "email": "",
                "role": "admin",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            db_user = await db.users.find_one({"username": "admin"}, {"_id": 0})
        else:
            raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")

    if not bcrypt.checkpw(user.password.encode(), db_user["password"].encode()):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")

    token = jwt.encode(
        {"username": db_user["username"], "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30},
        JWT_SECRET,
        algorithm="HS256"
    )
    return TokenResponse(token=token, username=db_user["username"], role=db_user.get("role", "admin"))


@router.get("/auth/me")
async def get_me(token: str):
    user = await get_current_user(token)
    return {"username": user["username"]}
