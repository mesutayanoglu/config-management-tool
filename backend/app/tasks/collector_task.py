import asyncio
from app.tasks.celery_app import celery_app


@celery_app.task(name="collect_all_scheduled")
def collect_all_scheduled():
    asyncio.run(_collect())


@celery_app.task(name="ping_all_devices")
def ping_all_devices():
    asyncio.run(_ping_all())


async def _collect():
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.scheduler import Scheduler, SchedulerDevice
    from app.models.device import Device
    from app.services.ssh_collector import collect_config

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Scheduler).where(Scheduler.is_active == 1))
        for scheduler in result.scalars().all():
            sd_result = await db.execute(
                select(SchedulerDevice).where(SchedulerDevice.scheduler_id == scheduler.id)
            )
            for sd in sd_result.scalars().all():
                dev_result = await db.execute(select(Device).where(Device.id == sd.device_id))
                device = dev_result.scalar_one_or_none()
                if device:
                    try:
                        result_data = await collect_config(device)
                        if result_data.get("model"):
                            device.model = result_data["model"]
                        if result_data.get("version"):
                            device.version = result_data["version"]
                        await db.commit()
                    except Exception as e:
                        print(f"[collector_task] {device.hostname} hata: {e}")


async def _ping_all():
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.device import Device
    from app.services.ping_service import ping_device

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Device))
        devices = result.scalars().all()
        for device in devices:
            try:
                is_online = await ping_device(device.ip_address)
                device.status = "online" if is_online else "offline"
            except Exception:
                device.status = "offline"
        await db.commit()
