"""APScheduler integration for scheduled configlet execution."""
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.configlet import Configlet, ConfigletDevice
from app.models.device import Device
from app.services.configlet_service import execute_on_device, render_template
from app.services.job_scheduler import _apscheduler
from app.services.email_service import send_configlet_notification

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)


def _make_trigger(c: Configlet):
    tod = c.time_of_day or "00:00"
    hour, minute = tod.split(":")

    if c.schedule_type == "interval":
        if c.interval_unit == "hours":
            return IntervalTrigger(hours=c.interval_value or 1)
        return IntervalTrigger(minutes=c.interval_value or 60)

    if c.schedule_type == "daily":
        return CronTrigger(hour=int(hour), minute=int(minute), timezone="Europe/Istanbul")

    if c.schedule_type == "weekly":
        return CronTrigger(
            day_of_week=c.days_of_week or "0",
            hour=int(hour),
            minute=int(minute),
            timezone="Europe/Istanbul",
        )

    if c.schedule_type == "monthly":
        return CronTrigger(
            day=c.day_of_month or 1,
            hour=int(hour),
            minute=int(minute),
            timezone="Europe/Istanbul",
        )

    return IntervalTrigger(minutes=60)


async def _run_configlet_job(configlet_id: int):
    logger.warning("[ConfigletScheduler id=%d] Job fired — starting", configlet_id)
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Configlet)
                .options(
                    selectinload(Configlet.configlet_devices).selectinload(ConfigletDevice.device)
                )
                .where(Configlet.id == configlet_id, Configlet.schedule_enabled == True)
            )
            c = result.scalar_one_or_none()
            if not c:
                logger.warning("[ConfigletScheduler id=%d] Not found or disabled — skipping", configlet_id)
                return

            device_ids = [cd.device_id for cd in c.configlet_devices]
            if not device_ids:
                logger.warning("[ConfigletScheduler id=%d] No devices — skipping", configlet_id)
                return

            res = await db.execute(
                select(Device)
                .options(selectinload(Device.credential_profile))
                .where(Device.id.in_(device_ids))
            )
            devices = res.scalars().all()

            defaults = {}
            if c.variable_defaults:
                try:
                    defaults = json.loads(c.variable_defaults)
                except Exception:
                    pass

            try:
                rendered = render_template(c.content, defaults)
            except Exception as e:
                logger.warning("[ConfigletScheduler id=%d] Template render error: %s", configlet_id, e)
                return

            logger.warning("[ConfigletScheduler:%s] Running for %d device(s)", c.name, len(devices))
            exec_results = []
            for device in devices:
                result_data = await execute_on_device(device, rendered)
                exec_results.append(result_data)
                logger.warning(
                    "[ConfigletScheduler:%s] %s — %s (%dms)",
                    c.name, result_data["status"], device.hostname, result_data["duration_ms"]
                )

            c.last_run_at = datetime.now(ZoneInfo("Europe/Istanbul")).replace(tzinfo=None)
            notification_email = c.notification_email
            configlet_name = c.name
            await db.commit()

        if notification_email:
            run_at = datetime.now(ZoneInfo("Europe/Istanbul")).strftime("%d.%m.%Y %H:%M")
            await send_configlet_notification(notification_email, configlet_name, run_at, exec_results)

    except Exception as exc:
        logger.warning("[ConfigletScheduler id=%d] Unexpected error: %s", configlet_id, exc)


def _register(c: Configlet):
    job_id = f"configlet_{c.id}"
    trigger = _make_trigger(c)
    _apscheduler.add_job(
        _run_configlet_job,
        trigger=trigger,
        id=job_id,
        args=[c.id],
        replace_existing=True,
        misfire_grace_time=300,
    )
    job = _apscheduler.get_job(job_id)
    next_run = job.next_run_time if job else "unknown"
    logger.warning("[ConfigletScheduler] Registered '%s' (id=%d) — next run: %s", c.name, c.id, next_run)


def unregister(configlet_id: int):
    job_id = f"configlet_{configlet_id}"
    if _apscheduler.get_job(job_id):
        _apscheduler.remove_job(job_id)
        logger.warning("[ConfigletScheduler] Unregistered id=%d", configlet_id)


async def reload(configlet_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Configlet).where(Configlet.id == configlet_id))
        c = result.scalar_one_or_none()
    if c and c.schedule_enabled and c.schedule_type:
        _register(c)
    else:
        unregister(configlet_id)


async def start():
    """Called from main.py lifespan to load all scheduled configlets."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Configlet).where(Configlet.schedule_enabled == True)
        )
        configlets = result.scalars().all()
    for c in configlets:
        if c.schedule_type:
            _register(c)
    logger.warning("[ConfigletScheduler] Started — %d job(s) loaded", len(configlets))
