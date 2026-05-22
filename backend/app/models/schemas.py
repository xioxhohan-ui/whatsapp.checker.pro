from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, Field, computed_field


# Auth Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    telegram_chat_id: Optional[str] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    role: str
    is_active: bool
    telegram_chat_id: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


# Job Schemas
class JobResponse(BaseModel):
    id: str
    user_id: str
    status: str
    total_numbers: int
    valid_count: int
    invalid_count: int
    duplicate_count: int
    provider: str
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NumberResponse(BaseModel):
    id: int
    job_id: str
    original_number: str
    normalized_number: Optional[str] = None
    status: str
    checked_at: datetime

    @computed_field
    @property
    def number(self) -> str:
        return self.normalized_number or self.original_number

    @computed_field
    @property
    def phone_number(self) -> str:
        return self.normalized_number or self.original_number

    @computed_field
    @property
    def whatsapp_link(self) -> Optional[str]:
        if self.status == "valid":
            return f"https://wa.me/{self.normalized_number}"
        return None

    class Config:
        from_attributes = True


# Analytics Schemas
class DailyStat(BaseModel):
    date: str
    checked: int
    valid: int
    invalid: int
    duplicate: int


class AnalyticsSummary(BaseModel):
    total_checked: int
    total_valid: int
    total_invalid: int
    total_duplicate: int
    success_rate: float
    daily_stats: List[DailyStat]
    provider_distribution: Dict[str, int] = Field(default_factory=dict)


# Admin Dashboard System Health
class SystemHealth(BaseModel):
    database_status: str
    redis_status: str
    celery_status: str
    redis_queue_length: int
    uptime: float


# ApiKey Schemas
class ApiKeyCreate(BaseModel):
    provider: str
    name: str
    credentials: Dict[str, Any]


class ApiKeyResponse(BaseModel):
    id: str
    user_id: str
    provider: str
    name: str
    credentials: Dict[str, Any]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
