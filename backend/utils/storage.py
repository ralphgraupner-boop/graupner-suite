import os
from database import EMERGENT_LLM_KEY, logger

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "graupner-suite"
storage_key = None

BASE_DIR = "/home/graupner/graupner-suite/backend/storage_data"


def init_storage():
    """Lokale Speicherung: kein externer Dienst mehr noetig, Verzeichnis nur sicherstellen."""
    os.makedirs(BASE_DIR, exist_ok=True)
    return "local"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Speichert eine Datei lokal auf dem Server (ersetzt den nicht mehr erreichbaren Emergent-Speicherdienst)."""
    init_storage()
    full_path = os.path.join(BASE_DIR, path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(data)
    try:
        with open(full_path + ".meta", "w", encoding="utf-8") as mf:
            mf.write(content_type or "application/octet-stream")
    except Exception as e:
        logger.warning(f"Konnte Content-Type nicht speichern fuer {path}: {e}")
    logger.info(f"Datei lokal gespeichert: {path} ({len(data)} bytes, {content_type})")
    return {"url": path, "path": path}


def get_object(path: str) -> tuple:
    """Liest eine lokal gespeicherte Datei wieder aus."""
    full_path = os.path.join(BASE_DIR, path)
    if not os.path.exists(full_path):
        raise FileNotFoundError(f"Datei nicht gefunden: {path}")
    with open(full_path, "rb") as f:
        data = f.read()
    content_type = "application/octet-stream"
    meta_path = full_path + ".meta"
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as mf:
                content_type = mf.read().strip() or content_type
        except Exception:
            pass
    return data, content_type


def delete_object(path: str) -> bool:
    """Loescht eine lokal gespeicherte Datei (Funktion fehlte bisher komplett im alten Code)."""
    full_path = os.path.join(BASE_DIR, path)
    deleted = False
    if os.path.exists(full_path):
        os.remove(full_path)
        deleted = True
    meta_path = full_path + ".meta"
    if os.path.exists(meta_path):
        os.remove(meta_path)
    if deleted:
        logger.info(f"Datei geloescht: {path}")
        return True
    logger.warning(f"Datei zum Loeschen nicht gefunden: {path}")
    return False
