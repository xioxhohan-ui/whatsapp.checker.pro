from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

import os

# Determine if we should use SQLite (default fallback for local development without Postgres)
use_sqlite = os.environ.get("USE_SQLITE") == "1"

if use_sqlite:
    # Ephemeral serverless containers on Vercel require SQLite database to be placed in the writeable /tmp path
    is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None
    sqlite_path = "/tmp/whatsapp_checker.db" if is_vercel else "./whatsapp_checker.db"
    db_url = f"sqlite+aiosqlite:///{sqlite_path}"
    connect_args = {"check_same_thread": False}
    engine = create_async_engine(db_url, echo=False, future=True, connect_args=connect_args)
else:
    db_url = settings.DATABASE_URL
    # Standard serverless platforms like Neon or Supabase provide postgres:// links.
    # Convert them to asyncpg-compatible URLs for SQLAlchemy.
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    engine = create_async_engine(
        db_url,
        echo=False,
        future=True,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10
    )

# Async session factory
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy database models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator for database sessions in routes."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
