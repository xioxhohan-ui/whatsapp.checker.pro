import os
import aiohttp
from typing import Generator
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.database.session import get_db
from app.models.database import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def verify_supabase_token(token: str) -> dict:
    """Verify Supabase JWT token either locally (if JWT_SECRET is configured) or remotely via Supabase Auth API."""
    # 1. Local verification if JWT_SECRET is configured
    jwt_secret = settings.SUPABASE_JWT_SECRET or os.environ.get("SUPABASE_JWT_SECRET")
    if jwt_secret:
        try:
            # Supabase tokens are signed with HS256 using JWT_SECRET
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
            return {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "role": payload.get("role", "user")
            }
        except JWTError:
            pass  # Fall through to remote check

    # 2. Remote verification via Supabase GoTrue Auth API
    supabase_url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
    if supabase_url:
        supabase_url = supabase_url.replace("/rest/v1/", "").replace("/rest/v1", "").rstrip("/")
    supabase_anon = settings.SUPABASE_ANON_KEY or os.environ.get("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_anon:
        # Fallback for developer tests (dummy auth) if no Supabase credentials exist
        if token.startswith("dummy_token_"):
            email = f"{token.split('_')[-1]}@example.com"
            role = "admin" if "admin" in email else "user"
            return {
                "id": f"usr_{token.split('_')[-1]}",
                "email": email,
                "role": role
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase credentials are not configured",
            headers={"WWW-Authenticate": "Bearer"},
        )

    url = f"{supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "apikey": supabase_anon,
        "Authorization": f"Bearer {token}"
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=5) as response:
                if response.status == 200:
                    data = await response.json()
                    role = data.get("user_metadata", {}).get("role", "user")
                    if data.get("email") == settings.ADMIN_EMAIL:
                        role = "admin"
                    return {
                        "id": data.get("id"),
                        "email": data.get("email"),
                        "role": role,
                        "avatar_url": data.get("user_metadata", {}).get("avatar_url")
                    }
    except Exception as e:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials with Supabase Auth",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """Dependency to retrieve currently logged in user via Supabase Auth."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    user_info = await verify_supabase_token(token)
    user_id = user_info["id"]

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Auto-heal profile: if user is logged in via Supabase but doesn't have a profile row yet
    if user is None:
        user = User(
            id=user_id,
            email=user_info["email"],
            role=user_info["role"],
            avatar_url=user_info.get("avatar_url"),
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Dependency to enforce that user has the admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions. Admin role required."
        )
    return current_user
