import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database.session import Base


class User(Base):
    __tablename__ = "profiles"

    id = Column(String, primary_key=True, index=True) # Supabase auth.users UUID
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True) # Retained for potential mock / direct auth bypass
    role = Column(String, default="user")  # admin, user
    is_active = Column(Boolean, default=True)
    telegram_chat_id = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending")  # pending, processing, done, failed
    total_numbers = Column(Integer, default=0)
    valid_count = Column(Integer, default=0)
    invalid_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    telegram_notifications = Column(Boolean, default=False)
    provider = Column(String, default="whatsapp_cloud")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="jobs")
    numbers = relationship("Number", back_populates="job", cascade="all, delete-orphan")


class Number(Base):
    __tablename__ = "numbers"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    original_number = Column(String, nullable=False)
    normalized_number = Column(String, nullable=True)
    status = Column(String, nullable=False)  # valid, invalid, duplicate
    checked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="numbers")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String, nullable=False)  # whatsapp_cloud, twilio, ultramsg
    name = Column(String, nullable=False)
    credentials = Column(Text, nullable=False)  # JSON string
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
