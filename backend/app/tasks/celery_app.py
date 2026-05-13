from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "config_collector",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.collector_task"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        # Her 5 dakikada tüm cihazları ping'le
        "ping-all-devices-every-5-min": {
            "task": "ping_all_devices",
            "schedule": 300.0,
        },
        # Scheduler'lara göre config topla (her dakika çalışır, kendi içinde filtreler)
        "collect-scheduled-configs": {
            "task": "collect_all_scheduled",
            "schedule": crontab(minute="*/5"),
        },
    },
)
