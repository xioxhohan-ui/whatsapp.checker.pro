import os
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock

# Append backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Mock asyncpg to prevent compile/load errors on host system
sys.modules['asyncpg'] = MagicMock()

# Mock redis module to run tests without running redis-server on host
class MockRedis:
    def __init__(self, *args, **kwargs):
        self.store = {}
        
    def ping(self):
        return True
        
    def get(self, key):
        val = self.store.get(key)
        if val is not None:
            return val.encode("utf-8") if isinstance(val, str) else val
        return None
        
    def set(self, key, value, *args, **kwargs):
        self.store[key] = value
        return True
        
    def delete(self, key):
        self.store.pop(key, None)
        return True
        
    def rpush(self, key, *values):
        if key not in self.store:
            self.store[key] = []
        # Encode values as bytes to simulate real redis
        self.store[key].extend([v.encode("utf-8") if isinstance(v, str) else v for v in values])
        return len(values)
        
    def lpop(self, key):
        if key in self.store and self.store[key]:
            return self.store[key].pop(0)
        return None
        
    def llen(self, key):
        if key in self.store:
            return len(self.store[key])
        return 0
        
    def publish(self, channel, message):
        return 1

    @classmethod
    def from_url(cls, *args, **kwargs):
        return cls()

mock_redis_module = MagicMock()
mock_redis_module.Redis = MockRedis

# Mock redis.asyncio as well
mock_asyncio = MagicMock()
mock_asyncio.from_url = MockRedis.from_url
sys.modules['redis'] = mock_redis_module
sys.modules['redis.asyncio'] = mock_asyncio

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

# Mock settings before importing main application
os.environ["POSTGRES_DB"] = "test_db"
os.environ["SECRET_KEY"] = "testsecretkeytestsecretkeytestsecretkey"
os.environ["REFRESH_SECRET_KEY"] = "testrefreshkeytestrefreshkeytestrefreshkey"

from app.main import app
from app.database.session import get_db
from app.database.session import Base
from app.models.database import User, Job, Number

# In-memory SQLite for testing async endpoints
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)


# Dependency override function
async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

# Override dependency
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


class TestSaaSBackend(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        # We need to create tables in the in-memory SQLite
        import asyncio
        async def init_models():
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        asyncio.run(init_models())

    def test_auth_and_numbers_flow(self):
        # 1. Register User
        reg_resp = client.post(
            "/api/v1/auth/register",
            json={"email": "tester@saas.com", "password": "password123"}
        )
        self.assertEqual(reg_resp.status_code, 200)
        self.assertEqual(reg_resp.json()["email"], "tester@saas.com")

        # 2. Login User
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "tester@saas.com", "password": "password123"}
        )
        self.assertEqual(login_resp.status_code, 200)
        tokens = login_resp.json()
        self.assertIn("access_token", tokens)
        self.assertIn("refresh_token", tokens)
        
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        # 3. Get Active User Profile
        me_resp = client.get("/api/v1/auth/me", headers=headers)
        self.assertEqual(me_resp.status_code, 200)
        self.assertEqual(me_resp.json()["email"], "tester@saas.com")

        # 4. Generate WhatsApp click-to-chat links
        link_resp = client.get("/api/v1/whatsapp/link/01717840013")
        self.assertEqual(link_resp.status_code, 200)
        data = link_resp.json()
        self.assertEqual(data["number"], "8801717840013")
        self.assertEqual(data["whatsapp_link"], "https://wa.me/8801717840013")

        # 5. Invalid WhatsApp link format check
        invalid_link_resp = client.get("/api/v1/whatsapp/link/12345")
        self.assertEqual(invalid_link_resp.status_code, 400)

        # 6. Paste numbers bulk input
        paste_resp = client.post(
            "/api/v1/numbers/paste",
            headers=headers,
            json={
                "numbers": [
                    "01819985042",
                    "01717840013",
                    "12345",
                    "01819985042"  # duplicate
                ],
                "telegram_notifications": False
            }
        )
        self.assertEqual(paste_resp.status_code, 200)
        job_data = paste_resp.json()
        self.assertEqual(job_data["status"], "pending")
        self.assertEqual(job_data["total_numbers"], 4)
        
        job_id = job_data["id"]

        # 7. Get Job details
        job_check = client.get(f"/api/v1/numbers/job/{job_id}", headers=headers)
        self.assertEqual(job_check.status_code, 200)
        self.assertEqual(job_check.json()["id"], job_id)


if __name__ == "__main__":
    unittest.main()
