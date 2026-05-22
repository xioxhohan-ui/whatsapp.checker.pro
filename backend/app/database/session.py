from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

import os

# Determine if we should use SQLite (default fallback for local development or auto-detected Vercel environment without Postgres)
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None
use_sqlite = os.environ.get("USE_SQLITE") == "1" or (is_vercel and not os.environ.get("DATABASE_URL"))

if use_sqlite:
    # Ephemeral serverless containers on Vercel require SQLite database to be placed in the writeable /tmp path
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


_db_initialized = False

async def ensure_db_initialized():
    global _db_initialized
    if _db_initialized:
        return
    
    # Run migrations / create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Seed default admin user
    from app.models.database import User
    from app.core.security import hash_password
    from sqlalchemy import select
    
    async with SessionLocal() as session:
        try:
            stmt = select(User).where(User.email == settings.ADMIN_EMAIL)
            result = await session.execute(stmt)
            admin_user = result.scalar_one_or_none()
            
            if not admin_user:
                hashed_pw = hash_password(settings.ADMIN_PASSWORD)
                new_admin = User(
                    id="usr_admin",
                    email=settings.ADMIN_EMAIL,
                    password_hash=hashed_pw,
                    role="admin",
                    is_active=True
                )
                session.add(new_admin)
                await session.commit()
            _db_initialized = True
        except Exception:
            await session.rollback()
            # Mark initialized so we don't spam attempts on lock/concurrency
            _db_initialized = True


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator for database sessions in routes."""
    await ensure_db_initialized()
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
