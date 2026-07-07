#!/usr/bin/env python3
"""
Patch-Skript: Registrierungs-Absicherung + Freigabe-Mechanismus fuer Graupner Suite
Aendert: backend/routes/auth.py
- register: Rolle immer "mitarbeiter", freigabe_status="wartet", kein Auto-Login mehr,
  Benachrichtigungsmail an service24@tischlerei-graupner.de (bcc: hhgraupner@gmail.com)
- login: verweigert Login, solange freigabe_status == "wartet"
- neu: GET /users/pending, PUT /users/{username}/freigabe, DELETE /users/{username}/ablehnen

Alles-oder-nichts: jede der drei Textstellen muss exakt einmal vorkommen,
sonst wird NICHTS geschrieben. Backup wird erst nach erfolgreicher Pruefung angelegt.
"""

import shutil
import sys
from datetime import datetime

PFAD = "/home/graupner/graupner-suite/backend/routes/auth.py"

# --- Patch 1: register-Funktion ersetzen ---------------------------------
ALT_REGISTER = '''@router.post("/auth/register", response_model=TokenResponse)
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
    return TokenResponse(token=token, username=user.username, role=user.role)'''

NEU_REGISTER = '''@router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    existing = await db.users.find_one({"username": user.username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Benutzer existiert bereits")

    hashed = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()

    user_doc = {
        "username": user.username,
        "password": hashed,
        "email": user.email,
        "role": "mitarbeiter",
        "freigabe_status": "wartet",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    try:
        from utils import send_email
        body = f"""
        <p>Ein neues Benutzerkonto wartet auf Freigabe in der Graupner Suite:</p>
        <p><strong>Benutzername:</strong> {user.username}<br>
        <strong>E-Mail:</strong> {user.email}</p>
        <p>Bitte in der Suite unter Einstellungen &rarr; Benutzer freigeben oder ablehnen.</p>
        """
        send_email(
            to_email="service24@tischlerei-graupner.de",
            subject="Graupner Suite: Neue Registrierung wartet auf Freigabe",
            body_html=body,
            bcc="hhgraupner@gmail.com"
        )
    except Exception as e:
        print(f"Freigabe-Benachrichtigung konnte nicht gesendet werden: {e}")

    return {"message": "Konto angelegt. Bitte warten Sie auf die Freigabe durch den Admin."}'''

# --- Patch 2: login-Funktion um Freigabe-Pruefung ergaenzen --------------
ALT_LOGIN = '''    if not bcrypt.checkpw(user.password.encode(), db_user["password"].encode()):
        raise HTTPException(status_code=401, detail="Ung\u00fcltige Anmeldedaten")

    token = jwt.encode(
        {"username": db_user["username"], "role": db_user.get("role", "admin"), "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30},
        JWT_SECRET,
        algorithm="HS256"
    )
    return TokenResponse(token=token, username=db_user["username"], role=db_user.get("role", "admin"))'''

NEU_LOGIN = '''    if db_user.get("freigabe_status") == "wartet":
        raise HTTPException(status_code=403, detail="Ihr Konto wartet noch auf Freigabe durch den Admin")

    if not bcrypt.checkpw(user.password.encode(), db_user["password"].encode()):
        raise HTTPException(status_code=401, detail="Ung\u00fcltige Anmeldedaten")

    token = jwt.encode(
        {"username": db_user["username"], "role": db_user.get("role", "admin"), "exp": datetime.now(timezone.utc).timestamp() + 86400 * 30},
        JWT_SECRET,
        algorithm="HS256"
    )
    return TokenResponse(token=token, username=db_user["username"], role=db_user.get("role", "admin"))


@router.get("/users/pending")
async def list_pending_users(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    pending = await db.users.find({"freigabe_status": "wartet"}, {"_id": 0, "password": 0}).to_list(100)
    return pending


@router.put("/users/{username}/freigabe")
async def freigeben_user(username: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    result = await db.users.update_one(
        {"username": username},
        {"$set": {"freigabe_status": "freigegeben"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    return {"message": "Benutzer freigegeben"}


@router.delete("/users/{username}/ablehnen")
async def ablehnen_user(username: str, user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Nur Admins")
    result = await db.users.delete_one({"username": username, "freigabe_status": "wartet"})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Wartender Benutzer nicht gefunden")
    return {"message": "Registrierung abgelehnt und gel\u00f6scht"}'''

PATCHES = [
    ("register-Funktion absichern", ALT_REGISTER, NEU_REGISTER),
    ("login-Pruefung + neue Freigabe-Endpunkte", ALT_LOGIN, NEU_LOGIN),
]


def main():
    with open(PFAD, "r", encoding="utf-8") as f:
        inhalt = f.read()

    # Phase 1: Alles-oder-nichts pruefen
    for name, alt, _ in PATCHES:
        anzahl = inhalt.count(alt)
        if anzahl != 1:
            print(f"ABBRUCH: Fundstelle fuer '{name}' kommt {anzahl}x vor (erwartet: 1). Es wurde NICHTS geaendert.")
            sys.exit(1)
        print(f"OK: Fundstelle fuer '{name}' genau 1x gefunden.")

    # Phase 2: Backup erst jetzt, nach erfolgreicher Pruefung
    zeitstempel = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_pfad = f"{PFAD}.backup_freigabe_fix_{zeitstempel}"
    shutil.copy2(PFAD, backup_pfad)
    print(f"Backup angelegt: {backup_pfad}")

    # Phase 3: Ersetzen
    neuer_inhalt = inhalt
    for name, alt, neu in PATCHES:
        neuer_inhalt = neuer_inhalt.replace(alt, neu)

    with open(PFAD, "w", encoding="utf-8") as f:
        f.write(neuer_inhalt)

    print("FERTIG: Alle Aenderungen erfolgreich geschrieben.")


if __name__ == "__main__":
    main()
