import io
import json
import os
import aiohttp
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update
import pandas as pd
import redis

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
    hash_password,
    verify_password,
)
from app.database.session import get_db
from app.api.deps import get_current_user, get_current_admin
from app.models.database import User, Job, Number
from app.models.schemas import (
    UserCreate,
    UserLogin,
    UserUpdate,
    UserResponse,
    Token,
    JobResponse,
    NumberResponse,
    AnalyticsSummary,
    DailyStat,
    SystemHealth,
)
from app.utils.normalization import normalize_bd_number
from app.workers.tasks import process_whatsapp_clean_job

from app.utils.redis_fallback import get_redis_client

router = APIRouter()
redis_client = get_redis_client(settings.REDIS_URL)


def trigger_job_processing(job_id: str):
    """Triggers background check processing. Prefers Celery if running, otherwise falls back to a daemon thread."""
    import os
    import threading
    import asyncio
    import logging
    local_logger = logging.getLogger("app.api.endpoints")
    
    try:
        # Check if we should auto-fallback to native threads (e.g. SQLite/Vercel)
        is_serverless = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None
        if is_serverless:
            raise RuntimeError("Running in serverless/offline environment. Fall back to background thread.")
            
        process_whatsapp_clean_job.delay(job_id)
        local_logger.info(f"Triggered job {job_id} successfully via Celery.")
    except Exception as e:
        local_logger.warning(f"Celery trigger failed or disabled. Spawning background thread for job {job_id}. Reason: {e}")
        from app.workers.tasks import process_job_async
        
        def thread_worker():
            try:
                # Run event loop safely inside daemon thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(process_job_async(job_id))
            except Exception as thread_err:
                local_logger.error(f"Background thread worker failed for job {job_id}: {thread_err}")
                
        thread = threading.Thread(target=thread_worker, daemon=True)
        thread.start()


# Request Pydantic Schemas inside API context
class PasteNumbersRequest(BaseModel):
    numbers: List[str]
    telegram_notifications: bool = False


class ProcessControlRequest(BaseModel):
    job_id: str


# ==========================================
# AUTHENTICATION
# ==========================================

@router.post("/auth/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Registers a new user account via Supabase Auth (with mock fallback)."""
    supabase_url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
    if supabase_url:
        supabase_url = supabase_url.replace("/rest/v1/", "").replace("/rest/v1", "").rstrip("/")
    supabase_anon = settings.SUPABASE_ANON_KEY or os.environ.get("SUPABASE_ANON_KEY")
    
    if supabase_url and supabase_anon:
        url = f"{supabase_url}/auth/v1/signup"
        headers = {"apikey": supabase_anon, "Content-Type": "application/json"}
        payload = {"email": user_in.email, "password": user_in.password}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=10) as response:
                    res_json = await response.json()
                    if response.status not in [200, 201]:
                        err_msg = res_json.get("msg") or res_json.get("error_description") or "Registration failed"
                        raise HTTPException(status_code=response.status, detail=err_msg)
                    
                    user_id = res_json.get("id")
                    if not user_id and "user" in res_json:
                        user_id = res_json["user"].get("id")
                        
                    if user_id:
                        role = "user"
                        if user_in.email == settings.ADMIN_EMAIL:
                            role = "admin"
                            
                        stmt = select(User).where(User.id == user_id)
                        res = await db.execute(stmt)
                        db_user = res.scalar_one_or_none()
                        
                        if not db_user:
                            try:
                                db_user = User(
                                    id=user_id,
                                    email=user_in.email,
                                    role=role,
                                    is_active=True
                                )
                                db.add(db_user)
                                await db.commit()
                                await db.refresh(db_user)
                            except Exception:
                                await db.rollback()
                                stmt = select(User).where(User.id == user_id)
                                res = await db.execute(stmt)
                                db_user = res.scalar_one()
                        return db_user
                    else:
                        raise HTTPException(status_code=400, detail="Failed to retrieve user ID from auth gateway")
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=400, detail=f"Registration auth exception: {str(e)}")
            
    # Legacy Fallback
    stmt = select(User).where(User.email == user_in.email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = "user"
    if user_in.email == settings.ADMIN_EMAIL:
        role = "admin"

    hashed = hash_password(user_in.password)
    user = User(
        id=f"usr_{int(datetime.now(timezone.utc).timestamp())}",
        email=user_in.email,
        password_hash=hashed,
        role=role,
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/auth/login", response_model=Token)
async def login(user_in: UserLogin, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT access and refresh tokens via Supabase Auth."""
    supabase_url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
    if supabase_url:
        supabase_url = supabase_url.replace("/rest/v1/", "").replace("/rest/v1", "").rstrip("/")
    supabase_anon = settings.SUPABASE_ANON_KEY or os.environ.get("SUPABASE_ANON_KEY")
    
    if supabase_url and supabase_anon:
        url = f"{supabase_url}/auth/v1/token?grant_type=password"
        headers = {"apikey": supabase_anon, "Content-Type": "application/json"}
        payload = {"email": user_in.email, "password": user_in.password}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=10) as response:
                    res_json = await response.json()
                    if response.status != 200:
                        err_msg = res_json.get("error_description") or res_json.get("msg") or "Incorrect email or password"
                        raise HTTPException(status_code=400, detail=err_msg)
                    
                    access_token = res_json.get("access_token")
                    refresh_token = res_json.get("refresh_token")
                    user_data = res_json.get("user", {})
                    user_id = user_data.get("id")
                    
                    stmt = select(User).where(User.id == user_id)
                    res = await db.execute(stmt)
                    user = res.scalar_one_or_none()
                    
                    if not user:
                        try:
                            role = "user"
                            if user_in.email == settings.ADMIN_EMAIL:
                                role = "admin"
                            user = User(
                                id=user_id,
                                email=user_in.email,
                                role=role,
                                is_active=True
                            )
                            db.add(user)
                            await db.commit()
                        except Exception:
                            await db.rollback()
                            stmt = select(User).where(User.id == user_id)
                            res = await db.execute(stmt)
                            user = res.scalar_one()
                    elif not user.is_active:
                        raise HTTPException(status_code=400, detail="Account is blocked")
                        
                    return Token(
                        access_token=access_token,
                        refresh_token=refresh_token,
                        token_type="bearer"
                    )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=400, detail=f"Login authentication failed: {str(e)}")
            
    # Legacy Fallback
    stmt = select(User).where(User.email == user_in.email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(user_in.password, user.password_hash):
        if user_in.email == settings.ADMIN_EMAIL and user_in.password == settings.ADMIN_PASSWORD:
            if not user:
                user = User(
                    id="usr_admin",
                    email=user_in.email,
                    role="admin",
                    is_active=True
                )
                db.add(user)
                await db.commit()
            access_token = f"dummy_token_admin"
            refresh_token = f"dummy_refresh_admin"
            return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is blocked")

    access_token = f"dummy_token_{user.id}"
    refresh_token = f"dummy_refresh_{user.id}"
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer"
    )


@router.post("/auth/refresh", response_model=Token)
async def refresh(refresh_token: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Exchange refresh token for a fresh access token via Supabase Auth."""
    supabase_url = settings.SUPABASE_URL or os.environ.get("SUPABASE_URL")
    if supabase_url:
        supabase_url = supabase_url.replace("/rest/v1/", "").replace("/rest/v1", "").rstrip("/")
    supabase_anon = settings.SUPABASE_ANON_KEY or os.environ.get("SUPABASE_ANON_KEY")
    
    if supabase_url and supabase_anon and not refresh_token.startswith("dummy_"):
        url = f"{supabase_url}/auth/v1/token?grant_type=refresh_token"
        headers = {"apikey": supabase_anon, "Content-Type": "application/json"}
        payload = {"refresh_token": refresh_token}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=10) as response:
                    res_json = await response.json()
                    if response.status != 200:
                        raise HTTPException(status_code=401, detail="Invalid refresh token")
                        
                    return Token(
                        access_token=res_json.get("access_token"),
                        refresh_token=res_json.get("refresh_token"),
                        token_type="bearer"
                    )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=401, detail="Refresh failed")
            
    if refresh_token.startswith("dummy_refresh_"):
        user_id = refresh_token.replace("dummy_refresh_", "")
        return Token(
            access_token=f"dummy_token_{user_id}",
            refresh_token=refresh_token,
            token_type="bearer"
        )
    raise HTTPException(status_code=401, detail="Invalid refresh token")


@router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Sign out active user sessions."""
    return {"message": "Logged out successfully"}


@router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get active authenticated user detail info."""
    return current_user


@router.put("/auth/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update profile password and telegram alert parameters."""
    if user_update.email:
        current_user.email = user_update.email
    if user_update.telegram_chat_id is not None:
        current_user.telegram_chat_id = user_update.telegram_chat_id
    if user_update.password:
        current_user.password_hash = hash_password(user_update.password)
        
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ==========================================
# NUMBERS HANDLERS
# ==========================================

@router.post("/numbers/upload", response_model=JobResponse)
async def upload_numbers(
    file: UploadFile = File(...),
    telegram_notifications: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Upload bulk list phone numbers file (TXT, CSV, XLS, XLSX). Creates a pending job."""
    raw_list = []
    content = await file.read()
    filename = file.filename.lower()
    
    try:
        if filename.endswith(".txt"):
            lines = content.decode("utf-8").splitlines()
            raw_list.extend([l.strip() for l in lines if l.strip()])
        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), header=None)
            for col in df.columns:
                raw_list.extend(df[col].dropna().astype(str).str.strip().tolist())
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), header=None)
            for col in df.columns:
                raw_list.extend(df[col].dropna().astype(str).str.strip().tolist())
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload TXT, CSV, or Excel.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Failed parsing file contents: {str(e)}")

    if not raw_list:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Create job
    job = Job(
        user_id=current_user.id,
        status="pending",
        total_numbers=len(raw_list),
        valid_count=0,
        invalid_count=0,
        duplicate_count=0,
        telegram_notifications=telegram_notifications
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Push to Redis
    redis_list_key = f"job_pending_nums_{job.id}"
    redis_client.rpush(redis_list_key, *raw_list)

    return job


@router.post("/numbers/paste", response_model=JobResponse)
async def paste_numbers(
    req: PasteNumbersRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a bulk list of numbers pasted as JSON string arrays. Creates a pending job."""
    raw_list = [num.strip() for num in req.numbers if num.strip()]
    if not raw_list:
        raise HTTPException(status_code=400, detail="Provided list contains no numbers.")

    job = Job(
        user_id=current_user.id,
        status="pending",
        total_numbers=len(raw_list),
        valid_count=0,
        invalid_count=0,
        duplicate_count=0,
        telegram_notifications=req.telegram_notifications
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Push to Redis
    redis_list_key = f"job_pending_nums_{job.id}"
    redis_client.rpush(redis_list_key, *raw_list)

    return job


@router.get("/numbers/job/{job_id}", response_model=JobResponse)
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve status and processed metric counters for a verification job."""
    stmt = select(Job).where(Job.id == job_id, Job.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/numbers/results/{job_id}", response_model=List[NumberResponse])
async def get_job_results(
    job_id: str,
    status_filter: Optional[str] = Query(None, pattern="^(valid|invalid|duplicate)$"),
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve detailed validation outcomes for numbers under a job (paginated)."""
    # Verify access
    stmt_job = select(Job).where(Job.id == job_id, Job.user_id == current_user.id)
    res_job = await db.execute(stmt_job)
    if not res_job.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    stmt = select(Number).where(Number.job_id == job_id)
    if status_filter:
        stmt = stmt.where(Number.status == status_filter)
    
    stmt = stmt.offset(offset).limit(limit).order_by(Number.id)
    res = await db.execute(stmt)
    return res.scalars().all()


# ==========================================
# PROCESSING QUEUE CONTROLS
# ==========================================

@router.post("/process/start")
async def start_job(
    req: ProcessControlRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start background Celery verification for a pending job."""
    stmt = select(Job).where(Job.id == req.job_id, Job.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status not in ["pending", "paused"]:
        raise HTTPException(status_code=400, detail=f"Cannot start a job in status '{job.status}'")

    # Clear pause flag
    redis_client.delete(f"job_paused_{job.id}")
    
    # Set status
    job.status = "processing"
    await db.commit()

    # Trigger Background check
    trigger_job_processing(job.id)
    return {"message": "Verification background processing started."}


@router.post("/process/pause")
async def pause_job(
    req: ProcessControlRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Signal processing job worker thread to suspend operations."""
    stmt = select(Job).where(Job.id == req.job_id, Job.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status != "processing":
        raise HTTPException(status_code=400, detail="Only actively processing jobs can be paused")

    # Set pause key in Redis
    redis_client.set(f"job_paused_{job.id}", "1")
    return {"message": "Job suspension command sent successfully."}


@router.post("/process/resume")
async def resume_job(
    req: ProcessControlRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resume a paused check run, picking up from remaining Redis queue entries."""
    stmt = select(Job).where(Job.id == req.job_id, Job.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "paused":
        raise HTTPException(status_code=400, detail="Only paused jobs can be resumed")

    # Clear pause flag in Redis
    redis_client.delete(f"job_paused_{job.id}")
    
    job.status = "processing"
    await db.commit()

    # Restart Background Task
    trigger_job_processing(job.id)
    return {"message": "Verification background processing resumed."}


# ==========================================
# EXPORT SERVICES
# ==========================================

async def get_export_data(job_id: str, filter_status: str, db: AsyncSession, user_id: int):
    # Verify job ownership
    stmt_job = select(Job).where(Job.id == job_id, Job.user_id == user_id)
    res_job = await db.execute(stmt_job)
    job = res_job.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Fetch numbers
    stmt = select(Number).where(Number.job_id == job_id)
    if filter_status == "valid":
        stmt = stmt.where(Number.status == "valid")
    elif filter_status == "invalid":
        stmt = stmt.where(Number.status == "invalid")
    elif filter_status == "cleaned":
        # Returns unique valid normalized numbers
        stmt = stmt.where(Number.status == "valid")
    
    res = await db.execute(stmt)
    results = res.scalars().all()

    if filter_status == "cleaned":
        # Deduplicate results using set just to be safe
        seen = set()
        cleaned_results = []
        for r in results:
            if r.normalized_number and r.normalized_number not in seen:
                seen.add(r.normalized_number)
                cleaned_results.append(r)
        return cleaned_results, job
        
    return results, job


@router.get("/export/csv/{job_id}")
async def export_csv(
    job_id: str,
    filter_status: str = Query("all", pattern="^(all|valid|invalid|cleaned)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export validation results as CSV file."""
    results, job = await get_export_data(job_id, filter_status, db, current_user.id)
    
    data_list = []
    for r in results:
        data_list.append({
            "Original Number": r.original_number,
            "Normalized Number": r.normalized_number or "",
            "Status": r.status,
            "WhatsApp Link": f"https://wa.me/{r.normalized_number}" if r.status == "valid" else "",
            "Checked At": r.checked_at.isoformat()
        })
        
    df = pd.DataFrame(data_list)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    
    filename = f"export_{job_id}_{filter_status}_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(stream.getvalue().encode("utf-8")), media_type="text/csv", headers=headers)


@router.get("/export/txt/{job_id}")
async def export_txt(
    job_id: str,
    filter_status: str = Query("all", pattern="^(all|valid|invalid|cleaned)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export validation results as raw line-by-line TXT file."""
    results, job = await get_export_data(job_id, filter_status, db, current_user.id)
    
    lines = []
    for r in results:
        # For valid and cleaned, output normalized list
        if filter_status in ["valid", "cleaned"]:
            lines.append(r.normalized_number)
        else:
            lines.append(f"{r.original_number},{r.normalized_number or ''},{r.status}")
            
    data = "\n".join(lines)
    filename = f"export_{job_id}_{filter_status}_{datetime.now().strftime('%Y%m%d%H%M%S')}.txt"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(data.encode("utf-8")), media_type="text/plain", headers=headers)


@router.get("/export/excel/{job_id}")
async def export_excel(
    job_id: str,
    filter_status: str = Query("all", pattern="^(all|valid|invalid|cleaned)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export validation results as Excel spreadsheet."""
    results, job = await get_export_data(job_id, filter_status, db, current_user.id)
    
    data_list = []
    for r in results:
        data_list.append({
            "Original Number": r.original_number,
            "Normalized Number": r.normalized_number or "",
            "Status": r.status,
            "WhatsApp Link": f"https://wa.me/{r.normalized_number}" if r.status == "valid" else "",
            "Checked At": r.checked_at.replace(tzinfo=None)
        })
        
    df = pd.DataFrame(data_list)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="WhatsApp Cleaner", index=False)
        
    output.seek(0)
    filename = f"export_{job_id}_{filter_status}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


# ==========================================
# ANALYTICS ENDPOINTS
# ==========================================

@router.get("/analytics/dashboard", response_model=AnalyticsSummary)
async def get_dashboard_analytics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch user account summary statistics."""
    stmt_jobs = select(Job).where(Job.user_id == current_user.id)
    res_jobs = await db.execute(stmt_jobs)
    jobs = res_jobs.scalars().all()

    total_checked = sum(j.total_numbers for j in jobs)
    total_valid = sum(j.valid_count for j in jobs)
    total_invalid = sum(j.invalid_count for j in jobs)
    total_duplicate = sum(j.duplicate_count for j in jobs)

    success_rate = round((total_valid / max(total_checked, 1)) * 100, 2)

    # Fetch daily statistics (last 7 days)
    daily_stats = []
    for i in range(6, -1, -1):
        target_date = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        target_start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
        target_end = datetime.combine(target_date, datetime.max.time(), tzinfo=timezone.utc)

        stmt = select(
            func.count(Number.id),
            func.count(func.nullif(Number.status != "valid", True)),
            func.count(func.nullif(Number.status != "invalid", True)),
            func.count(func.nullif(Number.status != "duplicate", True))
        ).join(Job).where(
            Job.user_id == current_user.id,
            Number.checked_at >= target_start,
            Number.checked_at <= target_end
        )
        res = await db.execute(stmt)
        res_all = res.all()[0]
        
        checked = res_all[0] or 0
        valid = res_all[1] or 0
        invalid = res_all[2] or 0
        duplicate = res_all[3] or 0

        daily_stats.append(DailyStat(
            date=target_date.strftime("%Y-%m-%d"),
            checked=checked,
            valid=valid,
            invalid=invalid,
            duplicate=duplicate
        ))

    provider_distribution = {}
    for j in jobs:
        provider_distribution[j.provider] = provider_distribution.get(j.provider, 0) + j.total_numbers

    return AnalyticsSummary(
        total_checked=total_checked,
        total_valid=total_valid,
        total_invalid=total_invalid,
        total_duplicate=total_duplicate,
        success_rate=success_rate,
        daily_stats=daily_stats,
        provider_distribution=provider_distribution
    )


@router.get("/analytics/daily", response_model=List[DailyStat])
async def get_daily_analytics(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve check volume history split daily over a specific day range."""
    stats_list = []
    for i in range(days - 1, -1, -1):
        target_date = (datetime.now(timezone.utc) - timedelta(days=i)).date()
        target_start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
        target_end = datetime.combine(target_date, datetime.max.time(), tzinfo=timezone.utc)

        stmt = select(
            func.count(Number.id),
            func.count(func.nullif(Number.status != "valid", True)),
            func.count(func.nullif(Number.status != "invalid", True)),
            func.count(func.nullif(Number.status != "duplicate", True))
        ).join(Job).where(
            Job.user_id == current_user.id,
            Number.checked_at >= target_start,
            Number.checked_at <= target_end
        )
        res = await db.execute(stmt)
        res_all = res.all()[0]
        
        checked = res_all[0] or 0
        valid = res_all[1] or 0
        invalid = res_all[2] or 0
        duplicate = res_all[3] or 0

        stats_list.append(DailyStat(
            date=target_date.strftime("%Y-%m-%d"),
            checked=checked,
            valid=valid,
            invalid=invalid,
            duplicate=duplicate
        ))

    return stats_list


# ==========================================
# WHATSAPP CLICK TO CHAT LINKS
# ==========================================

@router.get("/whatsapp/link/{number}")
async def get_whatsapp_link(number: str):
    """Generate WhatsApp click-to-chat link for a given number."""
    normalized = normalize_bd_number(number)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid Bangladesh number format.")
        
    return {
        "number": normalized,
        "status": "valid",
        "whatsapp_link": f"https://wa.me/{normalized}"
    }


# ==========================================
# ADMINISTRATOR CONTROL MODULES
# ==========================================

@router.get("/admin/users", response_model=List[UserResponse])
async def admin_list_users(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all registered users (Admin only)."""
    stmt = select(User).order_by(User.id)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/admin/users/{user_id}/toggle")
async def admin_toggle_user_status(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Block or unblock user accounts (Admin only)."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot block your own administrator profile")

    user.is_active = not user.is_active
    await db.commit()
    return {"message": f"User status changed to {'active' if user.is_active else 'blocked'}"}


@router.get("/admin/health", response_model=SystemHealth)
async def admin_health_check(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db)
):
    """Assess core database health, Redis broker response, and Celery active tasks."""
    db_status = "healthy"
    redis_status = "healthy"
    celery_status = "healthy"
    queue_len = 0
    
    # DB check
    try:
        await db.execute(select(1))
    except Exception:
        db_status = "unhealthy"

    # Redis check
    try:
        redis_client.ping()
        # Read Celery default queue length to monitor workloads
        queue_len = redis_client.llen("celery")
    except Exception:
        redis_status = "unhealthy"

    # Celery active check
    try:
        from app.workers.celery_app import celery_app
        insp = celery_app.control.inspect(timeout=1.0)
        pings = insp.ping()
        if not pings:
            celery_status = "unhealthy"
    except Exception:
        celery_status = "unhealthy"

    return SystemHealth(
        database_status=db_status,
        redis_status=redis_status,
        celery_status=celery_status,
        redis_queue_length=queue_len,
        uptime=100.0
    )


# ==========================================
# BACKWARD COMPATIBILITY ALIASES FOR FRONTEND
# ==========================================

@router.post("/jobs", response_model=JobResponse)
async def legacy_create_job(
    provider: str = Form(...),
    telegram_notifications: bool = Form(False),
    numbers_file: Optional[UploadFile] = File(None),
    numbers_paste: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raw_list = []
    if numbers_paste:
        raw_list.extend([line.strip() for line in numbers_paste.splitlines() if line.strip()])
    if numbers_file:
        content = await numbers_file.read()
        filename = numbers_file.filename.lower()
        if filename.endswith(".txt"):
            raw_list.extend([l.strip() for l in content.decode("utf-8").splitlines() if l.strip()])
        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content), header=None)
            for col in df.columns:
                raw_list.extend(df[col].dropna().astype(str).str.strip().tolist())
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content), header=None)
            for col in df.columns:
                raw_list.extend(df[col].dropna().astype(str).str.strip().tolist())

    if not raw_list:
        raise HTTPException(status_code=400, detail="No numbers provided.")

    job = Job(
        user_id=current_user.id,
        status="pending",
        total_numbers=len(raw_list),
        valid_count=0,
        invalid_count=0,
        duplicate_count=0,
        provider=provider,
        telegram_notifications=telegram_notifications
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Push to Redis
    redis_list_key = f"job_pending_nums_{job.id}"
    redis_client.rpush(redis_list_key, *raw_list)

    # Auto start
    redis_client.delete(f"job_paused_{job.id}")
    trigger_job_processing(job.id)
    return job


@router.get("/jobs", response_model=List[JobResponse])
async def legacy_list_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Job).where(Job.user_id == current_user.id).order_by(desc(Job.created_at))
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def legacy_get_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Job).where(Job.id == job_id, Job.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs/{job_id}/results", response_model=List[NumberResponse])
async def legacy_get_job_results(
    job_id: str,
    status_filter: Optional[str] = Query(None),
    limit: int = Query(100, ge=1),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt_job = select(Job).where(Job.id == job_id, Job.user_id == current_user.id)
    res_job = await db.execute(stmt_job)
    if not res_job.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Job not found")

    mapped_status = None
    if status_filter in ["valid", "business"]:
        mapped_status = "valid"
    elif status_filter == "invalid":
        mapped_status = "invalid"

    stmt = select(Number).where(Number.job_id == job_id)
    if mapped_status:
        stmt = stmt.where(Number.status == mapped_status)
    stmt = stmt.offset(offset).limit(limit).order_by(Number.id)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/jobs/{job_id}/action")
async def legacy_control_job(
    job_id: str,
    action: str = Query(..., pattern="^(pause|resume)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Job).where(Job.id == job_id, Job.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if action == "pause":
        redis_client.set(f"job_paused_{job_id}", "1")
        return {"message": "Job pausing scheduled"}
    elif action == "resume":
        redis_client.delete(f"job_paused_{job_id}")
        trigger_job_processing(job.id)
        return {"message": "Job resumption scheduled"}


@router.get("/jobs/{job_id}/export")
async def legacy_export_job(
    job_id: str,
    file_type: str = Query(..., pattern="^(txt|csv|xlsx)$"),
    filter_status: str = Query("all"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    mapped_status = "all"
    if filter_status == "valid":
        mapped_status = "valid"
    elif filter_status == "invalid":
        mapped_status = "invalid"
    elif filter_status == "unique_cleaned":
        mapped_status = "cleaned"
        
    if file_type == "csv":
        return await export_csv(job_id, mapped_status, current_user, db)
    elif file_type == "txt":
        return await export_txt(job_id, mapped_status, current_user, db)
    else:
        return await export_excel(job_id, mapped_status, current_user, db)


# ==========================================
# API KEYS & GATEWAY SETTINGS
# ==========================================

from app.models.database import ApiKey
from app.models.schemas import ApiKeyCreate, ApiKeyResponse

@router.post("/api-keys", response_model=ApiKeyResponse)
async def create_api_key(
    key_in: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if key already exists for this provider
    stmt = select(ApiKey).where(
        ApiKey.user_id == current_user.id,
        ApiKey.provider == key_in.provider
    )
    res = await db.execute(stmt)
    existing_key = res.scalar_one_or_none()

    if existing_key:
        # Update existing credentials
        existing_key.name = key_in.name
        existing_key.credentials = json.dumps(key_in.credentials)
        existing_key.is_active = True
        db.add(existing_key)
        await db.commit()
        await db.refresh(existing_key)
        key_obj = existing_key
    else:
        # Create new credentials configuration
        key_obj = ApiKey(
            user_id=current_user.id,
            provider=key_in.provider,
            name=key_in.name,
            credentials=json.dumps(key_in.credentials),
            is_active=True
        )
        db.add(key_obj)
        await db.commit()
        await db.refresh(key_obj)
    
    return ApiKeyResponse(
        id=key_obj.id,
        user_id=key_obj.user_id,
        provider=key_obj.provider,
        name=key_obj.name,
        credentials=json.loads(key_obj.credentials),
        is_active=key_obj.is_active,
        created_at=key_obj.created_at
    )


@router.get("/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ApiKey).where(ApiKey.user_id == current_user.id)
    res = await db.execute(stmt)
    keys = res.scalars().all()
    
    return [
        ApiKeyResponse(
            id=key.id,
            user_id=key.user_id,
            provider=key.provider,
            name=key.name,
            credentials=json.loads(key.credentials),
            is_active=key.is_active,
            created_at=key.created_at
        )
        for key in keys
    ]


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
    res = await db.execute(stmt)
    key_obj = res.scalar_one_or_none()
    if not key_obj:
        raise HTTPException(status_code=404, detail="API Key not found")
        
    await db.delete(key_obj)
    await db.commit()
    return {"message": "API Key configuration deleted"}


# ==========================================
# ROOT ANALYTICS ENDPOINT
# ==========================================

@router.get("/analytics", response_model=AnalyticsSummary)
async def get_analytics_root(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await get_dashboard_analytics(current_user, db)

