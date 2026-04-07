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
        {"username": user.username, "role": user.role, "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30},
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
        {"username": db_user["username"], "role": db_user.get("role", "admin"), "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30},
        JWT_SECRET,
        algorithm="HS256"
    )
    return TokenResponse(token=token, username=db_user["username"], role=db_user.get("role", "admin"))


@router.get("/auth/me")
async def get_me(user=Depends(get_current_user)):
    db_user = await db.users.find_one({"username": user["username"]}, {"_id": 0, "password": 0})
    if not db_user:
        return {"username": user["username"], "role": user.get("role", "admin")}
    return {"username": db_user["username"], "role": db_user.get("role", "admin"), "email": db_user.get("email", "")}


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


@router.post("/users/{username}/send-credentials")
async def send_credentials_email(username: str, data: dict, user=Depends(get_current_user)):
    """Sendet Zugangsdaten per E-Mail an den Benutzer"""
    from utils import send_email
    from utils.email_signatur import wrap_email_body

    password = data.get("password", "")
    if not password:
        raise HTTPException(status_code=400, detail="Passwort fehlt")

    db_user = await db.users.find_one({"username": username}, {"_id": 0, "password": 0})
    if not db_user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    email = db_user.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Keine E-Mail-Adresse hinterlegt")

    role_labels = {"admin": "Administrator", "mitarbeiter": "Mitarbeiter", "buchhaltung": "Buchhaltung"}
    role_label = role_labels.get(db_user.get("role", ""), db_user.get("role", ""))

    body = f"""
    <h2 style="color: #003366;">Ihre Zugangsdaten zur Graupner Suite</h2>
    <p>Hallo <strong>{username}</strong>,</p>
    <p>hier sind Ihre aktuellen Zugangsdaten:</p>
    <table cellpadding="8" cellspacing="0" style="border: 1px solid #ddd; border-collapse: collapse; margin: 16px 0;">
        <tr style="background: #f8f9fa;"><td style="border: 1px solid #ddd; font-weight: bold;">Benutzername</td><td style="border: 1px solid #ddd;">{username}</td></tr>
        <tr><td style="border: 1px solid #ddd; font-weight: bold;">Passwort</td><td style="border: 1px solid #ddd; font-family: monospace; font-size: 15px;">{password}</td></tr>
        <tr style="background: #f8f9fa;"><td style="border: 1px solid #ddd; font-weight: bold;">Rolle</td><td style="border: 1px solid #ddd;">{role_label}</td></tr>
    </table>
    <p style="color: #666; font-size: 13px;">Bitte ändern Sie Ihr Passwort nach der ersten Anmeldung.</p>
    """

    html = wrap_email_body(body)

    try:
        send_email(to_email=email, subject="Ihre Zugangsdaten – Graupner Suite", body_html=html)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"E-Mail konnte nicht gesendet werden: {str(e)}")

    return {"message": f"Zugangsdaten an {email} gesendet"}
