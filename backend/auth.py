from fastapi import HTTPException
import jwt
from database import JWT_SECRET


async def get_current_user(token: str = None):
    if not token:
        raise HTTPException(status_code=401, detail="Token fehlt")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
