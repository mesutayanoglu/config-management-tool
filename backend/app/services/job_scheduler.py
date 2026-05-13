import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.device import Device
from app.models.organization import Site
from app.models.scheduler import Scheduler, SchedulerDevice
from app.services.ssh_collector import collect_config

# Use WARNING so messages are always visible in uvicorn output
logging.getLogger("apscheduler").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)

_apscheduler = AsyncIOScheduler(timezone="Europe/Istanbul")


def _make_trigger(s: Scheduler):
    tod = s.time_of_day or "00:00"
    hour, minute = tod.split(":")

    if s.schedule_type == "interval":
        if s.interval_unit == "hours":
            return IntervalTrigger(hours=s.interval_value)
        return IntervalTrigger(minutes=s.interval_value)

    if s.schedule_type == "daily":
        return CronTrigger(hour=int(hour), minute=int(minute), timezone="Europe/Istanbul")

    if s.schedule_type == "weekly":
        return CronTrigger(
            day_of_week=s.days_of_week or "0",
            hour=int(hour),
            minute=int(minute),
            timezone="Europe/Istanbul",
        )

    if s.schedule_type == "monthly":
        return CronTrigger(
            day=s.day_of_month or 1,
            hour=int(hour),
            minute=int(minute),
            timezone="Europe/Istanbul",
        )

    return IntervalTrigger(minutes=60)


async def _run_job(scheduler_id: int):
    logger.warning("[Scheduler id=%d] Job fired — starting", scheduler_id)
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Scheduler)
                .options(
                    selectinload(Scheduler.scheduler_devices).selectinload(SchedulerDevice.device),
                )
                .where(Scheduler.id == scheduler_id, Scheduler.is_active == 1)
            )
            s = result.scalar_one_or_none()
            if not s:
                logger.warning("[Scheduler id=%d] Not found or inactive — skipping", scheduler_id)
                return

            if s.target_type == "manual":
                devices = [sd.device for sd in s.scheduler_devices if sd.device]
            elif s.target_type == "org":
                res = await db.execute(
                    select(Device)
                    .join(Device.site)
                    .where(Site.organization_id == s.target_org_id)
                )
                devices = res.scalars().all()
            elif s.target_type == "site":
                res = await db.execute(
                    select(Device).where(Device.site_id == s.target_site_id)
                )
                devices = res.scalars().all()
            else:
                devices = []

            logger.warning("[Scheduler:%s] Running for %d device(s)", s.name, len(devices))

            for device in devices:
                try:
                    await collect_config(device)
                    logger.warning("[Scheduler:%s] OK — %s", s.name, device.hostname)
                except Exception as exc:
                    logger.warning("[Scheduler:%s] FAIL — %s: %s", s.name, device.hostname, exc)

            s.last_run_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()

    except Exception as exc:
        logger.warning("[Scheduler id=%d] Unexpected error: %s", scheduler_id, exc)


def _register(s: Scheduler):
    job_id = f"sched_{s.id}"
    trigger = _make_trigger(s)
    _apscheduler.add_job(
        _run_job,
        trigger=trigger,
        id=job_id,
        args=[s.id],
        replace_existing=True,
        misfire_grace_time=300,
    )
    job = _apscheduler.get_job(job_id)
    next_run = job.next_run_time if job else "unknown"
    logger.warning("[JobScheduler] Registered '%s' (id=%d) — next run: %s", s.name, s.id, next_run)


def unregister(scheduler_id: int):
    job_id = f"sched_{scheduler_id}"
    if _apscheduler.get_job(job_id):
        _apscheduler.remove_job(job_id)
        logger.warning("[JobScheduler] Unregistered id=%d", scheduler_id)


async def reload(scheduler_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Scheduler).where(Scheduler.id == scheduler_id)
        )
        s = result.scalar_one_or_none()
    if s and s.is_active:
        _register(s)
    else:
        unregister(scheduler_id)


async def start():
    _apscheduler.start()
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Scheduler).where(Scheduler.is_active == 1)
        )
        schedulers = result.scalars().all()
    for s in schedulers:
        _register(s)
    logger.warning("[JobScheduler] Started — %d job(s) loaded", len(schedulers))


def stop():
    if _apscheduler.running:
        _apscheduler.shutdown(wait=False)
