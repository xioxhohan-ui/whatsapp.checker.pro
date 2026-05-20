import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.database.session import engine, Base, SessionLocal
from app.models.database import User
from app.api.endpoints import router as api_router
from app.websocket.manager import manager
from app.workers.celery_app import celery_app

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager handling startup DB migrations and admin seeding."""
    logger.info("Initializing database and models...")
    async with engine.begin() as conn:
        # Create all tables if they do not exist
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed default admin user
    async with SessionLocal() as session:
        try:
            stmt = select(User).where(User.email == settings.ADMIN_EMAIL)
            result = await session.execute(stmt)
            admin_user = result.scalar_one_or_none()
            
            if not admin_user:
                logger.info(f"Seeding default admin user: {settings.ADMIN_EMAIL}")
                hashed_pw = hash_password(settings.ADMIN_PASSWORD)
                new_admin = User(
                    email=settings.ADMIN_EMAIL,
                    password_hash=hashed_pw,
                    role="admin",
                    is_active=True
                )
                session.add(new_admin)
                await session.commit()
            else:
                logger.info("Admin user already seeded.")
        except Exception as e:
            logger.error(f"Error seeding admin user: {str(e)}")
            await session.rollback()

    yield
    logger.info("Shutting down application...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(api_router, prefix=settings.API_V1_STR)


# ==========================================
# WEBSOCKET REALTIME UPDATES
# ==========================================

@app.websocket("/api/v1/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    """WebSocket connection route for streaming checking logs and job statistics."""
    await manager.connect(websocket, job_id)
    try:
        # Loop to keep the connection alive
        while True:
            # Client can send heartbeat messages, but we mostly stream downstream data
            data = await websocket.receive_text()
            # Send simple pong response
            await websocket.send_text(f"heartbeat_ack: {data}")
    except WebSocketDisconnect:
        await manager.disconnect(websocket, job_id)
    except Exception as e:
        logger.error(f"WebSocket error for job {job_id}: {str(e)}")
        await manager.disconnect(websocket, job_id)
