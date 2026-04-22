"""
Portal v2 – Pydantic-Models
Strikt isoliert. Keine Wiederverwendung aus anderen Modulen.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal
from datetime import datetime, timezone
from uuid import uuid4


# ============== ACCOUNT ==============

class PortalAccountCreate(BaseModel):
    name: str
    email: str
    customer_id: Optional[str] = None  # Verknuepfung zu module_kunden (optional)
    notes: Optional[str] = ""


class PortalAccountUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class PortalAccount(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    customer_id: Optional[str] = None
    name: str
    email: str
    password_hash: Optional[str] = None
    token: Optional[str] = None
    active: bool = True
    notes: str = ""
    last_login: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============== SETTINGS ==============

class PortalV2Settings(BaseModel):
    feature_enabled: bool = False
    rate_limit_uploads: int = 20  # max Uploads/Stunde pro Account
    rate_limit_window_sec: int = 3600
    email_subject_invite: str = "Ihr Kundenzugang – Graupner Suite"
    email_footer: str = ""


class PortalV2SettingsUpdate(BaseModel):
    feature_enabled: Optional[bool] = None
    rate_limit_uploads: Optional[int] = None
    rate_limit_window_sec: Optional[int] = None
    email_subject_invite: Optional[str] = None
    email_footer: Optional[str] = None
