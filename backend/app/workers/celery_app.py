import os
from celery import Celery
from app.core.config import settings

use_sqlite = os.environ.get("USE_SQLITE") == "1"

if use_sqlite:
    broker_url = "memory://"
    result_backend = "cache+memory://"
else:
    broker_url = settings.REDIS_URL
    result_backend = settings.REDIS_URL

celery_app = Celery(
    "tasks",
    broker=broker_url,
    backend=result_backend
)

# Celery configurations
celery_app.conf.update(
    task_always_eager=use_sqlite,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,  # Prefetch 1 task at a time for fine-grained task status control
)

# Automatically load tasks from workers package
celery_app.autodiscover_tasks(["app.workers"])
