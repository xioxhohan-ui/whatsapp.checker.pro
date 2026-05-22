import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "WhatsApp Number Intelligence & Messaging Dashboard Pro"
    API_V1_STR: str = "/api/v1"
    
    # JWT & Security Settings
    SECRET_KEY: str = "supersecretjwtkeythatshouldbechangedinproduction1234567890!"
    REFRESH_SECRET_KEY: str = "supersecretrefreshjwtkeythatshouldbechangedinproduction1234567890!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # API Key Encryption (Fernet Key must be 32 URL-safe base64-encoded bytes)
    # Generated using: cryptography.fernet.Fernet.generate_key()
    # Default is a placeholder, should be set in environment
    ENCRYPTION_KEY: str = "Zl8tT1F5RnpzX3lWbVd5Q1E0R3hKcjE4TmtNdTVkYkw="
    
    # Database Configuration
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "whatsapp_checker"
    
    @property
    def DATABASE_URL(self) -> str:
        env_url = os.environ.get("DATABASE_URL")
        if env_url:
            return env_url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        
    @property
    def SYNC_DATABASE_URL(self) -> str:
        env_url = os.environ.get("DATABASE_URL")
        if env_url:
            return env_url
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: str = "6379"
    
    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # Admin Seeding
    ADMIN_EMAIL: str = "admin@whatsappchecker.pro"
    ADMIN_PASSWORD: str = "AdminSecret123!"

    # Telegram Notification (optional, loaded from environment)
    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_CHAT_ID: str | None = None

    # Database Fallback
    USE_SQLITE: str = "0"

    # Supabase Settings
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str | None = None

    # Load .env from root, backend, or current working directory
    _root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env")
    _backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")

    model_config = SettingsConfigDict(
        env_file=(_root_env, _backend_env, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
