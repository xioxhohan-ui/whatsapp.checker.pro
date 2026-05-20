import asyncio
import json
import time
import logging
from datetime import datetime, timezone
import aiohttp
from celery import shared_task
from sqlalchemy import select, update, insert
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
import redis

from app.core.config import settings
from app.models.database import Job, Number, User, ApiKey
from app.utils.normalization import normalize_bd_number

logger = logging.getLogger(__name__)

from app.utils.redis_fallback import get_redis_client
from app.database.session import SessionLocal

# Synchronous redis client for Celery task lifecycle & queue operations
redis_client = get_redis_client(settings.REDIS_URL)

# Async engine for SQLAlchemy inside Celery tasks
AsyncSessionMaker = SessionLocal


async def send_telegram_notification(token: str, chat_id: str, text: str):
    """Sends a status message to the Telegram channel on completion."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=10) as response:
                if response.status != 200:
                    logger.error(f"Telegram alert failed: {response.status} - {await response.text()}")
    except Exception as e:
        logger.error(f"Telegram connection error: {str(e)}")


async def check_whatsapp_via_waapi(session: aiohttp.ClientSession, number: str, token: str, instance_id: str, sem: asyncio.Semaphore) -> bool:
    """Query WaAPI to check if number is registered on WhatsApp."""
    url = f"https://waapi.app/api/v1/instances/{instance_id}/client/action/is-registered-user"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "accept": "application/json"
    }
    payload = {
        "contactId": f"{number}@c.us"
    }
    async with sem:
        try:
            await asyncio.sleep(0.01)  # small rate-limit buffer
            async with session.post(url, json=payload, headers=headers, timeout=8) as response:
                if response.status == 200:
                    res_data = await response.json()
                    is_registered = res_data.get("data", {}).get("data", {}).get("isRegisteredUser", False)
                    return is_registered
                else:
                    logger.warning(f"WaAPI error {response.status} for {number}: {await response.text()}")
        except Exception as e:
            logger.error(f"WaAPI exception checking {number}: {e}")
    return True


async def process_job_async(job_id: str):
    """Async background task checking numbers, cleaning duplicates, and updating database stats."""
    async with AsyncSessionMaker() as db:
        # 1. Fetch job record
        stmt = select(Job).where(Job.id == job_id)
        result = await db.execute(stmt)
        job = result.scalar_one_or_none()
        
        if not job:
            logger.error(f"Job {job_id} not found in database.")
            return

        # Update status to processing
        job.status = "processing"
        await db.commit()

        pub_channel = f"job_progress_{job_id}"
        redis_list_key = f"job_pending_nums_{job_id}"
        redis_set_key = f"job_seen_nums_{job_id}"
        
        # Batch size for bulk insertions (highly optimized for 100K+ lists)
        batch_size = 1000
        check_delay = 0.05
        
        start_time = time.time()
        processed_in_session = 0

        while True:
            # Check pause status
            is_paused = redis_client.get(f"job_paused_{job_id}")
            if is_paused and is_paused.decode("utf-8") == "1":
                job.status = "paused"
                await db.commit()
                redis_client.publish(pub_channel, json.dumps({
                    "job_id": job_id,
                    "status": "paused",
                    "log": "Job processing paused by user."
                }))
                break

            # Pop a batch of numbers
            raw_nums = []
            for _ in range(batch_size):
                val = redis_client.lpop(redis_list_key)
                if val:
                    raw_nums.append(val.decode("utf-8"))
                else:
                    break
            
            if not raw_nums:
                # Processing completed!
                job.status = "done"
                job.completed_at = datetime.now(timezone.utc)
                await db.commit()
                
                duration = time.time() - start_time
                avg_speed = round(job.total_numbers / max(duration, 1), 2)
                
                # Cleanup redis seen cache
                redis_client.delete(redis_set_key)
                
                # Send telegram notification if configured
                if job.telegram_notifications:
                    stmt_user = select(User).where(User.id == job.user_id)
                    user_res = await db.execute(stmt_user)
                    user_obj = user_res.scalar_one_or_none()
                    
                    telegram_token = settings.TELEGRAM_BOT_TOKEN
                    telegram_chat = user_obj.telegram_chat_id if user_obj else None
                    if not telegram_chat:
                        telegram_chat = settings.TELEGRAM_CHAT_ID

                    if telegram_token and telegram_chat:
                        msg = (
                            f"<b>🚀 Number Cleaner Job Finished!</b>\n\n"
                            f"<b>Job ID:</b> {job_id}\n"
                            f"<b>Total Checked:</b> {job.total_numbers}\n"
                            f"<b>Valid Format:</b> {job.valid_count}\n"
                            f"<b>Invalid Format:</b> {job.invalid_count}\n"
                            f"<b>Duplicate Count:</b> {job.duplicate_count}\n"
                            f"<b>Average Speed:</b> {avg_speed} nums/sec"
                        )
                        await send_telegram_notification(telegram_token, telegram_chat, msg)

                # Broadcast done
                redis_client.publish(pub_channel, json.dumps({
                    "job_id": job_id,
                    "status": "done",
                    "processed_count": job.total_numbers,
                    "valid_count": job.valid_count,
                    "invalid_count": job.invalid_count,
                    "duplicate_count": job.duplicate_count,
                    "total_count": job.total_numbers,
                    "progress_percent": 100.0,
                    "log": f"Processing completed. Checked: {job.total_numbers}. Valid: {job.valid_count}. Invalid: {job.invalid_count}. Duplicates: {job.duplicate_count}."
                }))
                break

            # Process the batch
            db_numbers_to_insert = []
            valid_inc = 0
            invalid_inc = 0
            duplicate_inc = 0
            log_messages = []

            numbers_to_check = []
            for raw_num in raw_nums:
                normalized = normalize_bd_number(raw_num)
                if not normalized:
                    status = "invalid"
                    invalid_inc += 1
                    db_numbers_to_insert.append({
                        "job_id": job_id,
                        "original_number": raw_num,
                        "normalized_number": normalized,
                        "status": status,
                        "checked_at": datetime.now(timezone.utc)
                    })
                    log_messages.append(f"Number {raw_num} -> status: invalid (format check failed)")
                else:
                    is_new = redis_client.sadd(redis_set_key, normalized)
                    if is_new == 1:
                        numbers_to_check.append((raw_num, normalized))
                    else:
                        status = "duplicate"
                        duplicate_inc += 1
                        db_numbers_to_insert.append({
                            "job_id": job_id,
                            "original_number": raw_num,
                            "normalized_number": normalized,
                            "status": status,
                            "checked_at": datetime.now(timezone.utc)
                        })
                        log_messages.append(f"Number {raw_num} -> status: duplicate (normalized: {normalized})")

            if numbers_to_check:
                stmt_key = select(ApiKey).where(ApiKey.user_id == job.user_id, ApiKey.is_active == True)
                res_key = await db.execute(stmt_key)
                api_keys = res_key.scalars().all()
                
                token = "eB8fx5cnZUPJzJUPPh9jceUWXdC8GPOe3tDwnCUm25cf1564"
                instance_id = "93169"
                for key in api_keys:
                    if key.provider == "whatsapp_cloud":
                        try:
                            creds = json.loads(key.credentials)
                            if creds.get("access_token") and creds.get("phone_number_id"):
                                token = creds.get("access_token")
                                instance_id = creds.get("phone_number_id")
                        except Exception:
                            pass
                
                sem = asyncio.Semaphore(15)
                async with aiohttp.ClientSession() as session:
                    tasks_list = [
                        check_whatsapp_via_waapi(session, normalized, token, instance_id, sem)
                        for _, normalized in numbers_to_check
                    ]
                    results = await asyncio.gather(*tasks_list)
                
                for (raw_num, normalized), is_valid in zip(numbers_to_check, results):
                    if is_valid:
                        status = "valid"
                        valid_inc += 1
                    else:
                        status = "invalid"
                        invalid_inc += 1
                    
                    db_numbers_to_insert.append({
                        "job_id": job_id,
                        "original_number": raw_num,
                        "normalized_number": normalized,
                        "status": status,
                        "checked_at": datetime.now(timezone.utc)
                    })
                    log_messages.append(f"Number {raw_num} -> status: {status} (WaAPI checked, normalized: {normalized})")

            # Bulk insert using execute(insert())
            if db_numbers_to_insert:
                await db.execute(insert(Number), db_numbers_to_insert)

            # Update job counts
            job.valid_count += valid_inc
            job.invalid_count += invalid_inc
            job.duplicate_count += duplicate_inc
            await db.commit()

            processed_in_session += len(raw_nums)
            total_processed = job.valid_count + job.invalid_count + job.duplicate_count
            
            elapsed = time.time() - start_time
            speed = round(processed_in_session / max(elapsed, 0.1), 2)
            progress_pct = round((total_processed / max(job.total_numbers, 1)) * 100, 2)

            # Broadcast progress
            redis_client.publish(pub_channel, json.dumps({
                "job_id": job_id,
                "status": "processing",
                "processed_count": total_processed,
                "valid_count": job.valid_count,
                "invalid_count": job.invalid_count,
                "duplicate_count": job.duplicate_count,
                "total_count": job.total_numbers,
                "progress_percent": progress_pct,
                "speed": speed,
                "log": "\n".join(log_messages[:50]) + (f"\n...and {len(log_messages)-50} more entries." if len(log_messages) > 50 else "")
            }))

            await asyncio.sleep(check_delay)


@shared_task(name="process_whatsapp_clean_job")
def process_whatsapp_clean_job(job_id: str):
    """Celery task launcher."""
    logger.info(f"Celery running clean job: {job_id}")
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import threading
        thread = threading.Thread(target=lambda: asyncio.run(process_job_async(job_id)))
        thread.start()
        thread.join()
    else:
        asyncio.run(process_job_async(job_id))
    return f"Completed job {job_id}"
