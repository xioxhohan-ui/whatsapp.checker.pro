from datetime import datetime, timedelta, timezone
from typing import Any, Union
from jose import jwt, JWTError
import bcrypt
from cryptography.fernet import Fernet
from app.core.config import settings

# Fernet encryption for API keys
fernet_client = Fernet(settings.ENCRYPTION_KEY.encode())


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify standard text password against hash."""
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Create JWT access token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    """Create JWT refresh token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
        
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    return jwt.encode(to_encode, settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str, is_refresh: bool = False) -> str | None:
    """Verify token validity and return subject (user id)."""
    try:
        secret = settings.REFRESH_SECRET_KEY if is_refresh else settings.SECRET_KEY
        payload = jwt.decode(token, secret, algorithms=[settings.ALGORITHM])
        token_type = payload.get("type")
        expected_type = "refresh" if is_refresh else "access"
        if token_type != expected_type:
            return None
        return payload.get("sub")
    except JWTError:
        return None


def encrypt_api_key(api_key: str) -> str:
    """Encrypt third-party API key for DB storage."""
    return fernet_client.encrypt(api_key.encode()).decode()


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt third-party API key from DB storage."""
    return fernet_client.decrypt(encrypted_key.encode()).decode()
