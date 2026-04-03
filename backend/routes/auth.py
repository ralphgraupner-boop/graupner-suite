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
async def get_me(user=Depends(get_current_user)):
    return {"username": user["username"]}


@router.get("/users")
async def list_users(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(100)
    return users


@router.post("/users")
async def create_user(data: UserCreate, user=Depends(get_current_user)):
    existing = await db.users.find_one({"username": data.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Benutzer existiert bereits")
    hashed = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user_doc = {
        "username": data.username,
        "password": hashed,
        "email": data.email,
        "role": data.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    return {"message": "Benutzer erstellt", "username": data.username}


@router.delete("/users/{username}")
async def delete_user(username: str, user=Depends(get_current_user)):
    if username == user.get("username"):
        raise HTTPException(status_code=400, detail="Sie können sich nicht selbst löschen")
    result = await db.users.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    return {"message": "Benutzer gelöscht"}


@router.put("/users/{username}/password")
async def change_password(username: str, data: dict, user=Depends(get_current_user)):
    new_password = data.get("password", "")
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="Passwort muss mindestens 4 Zeichen lang sein")
    hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    result = await db.users.update_one({"username": username}, {"$set": {"password": hashed}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    return {"message": "Passwort geändert"}
