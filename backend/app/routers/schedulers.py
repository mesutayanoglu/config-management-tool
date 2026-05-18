from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, get_write_user
from app.models.scheduler import Scheduler, SchedulerDevice
from app.models.user import User
from app.schemas.scheduler import (
    DeviceBrief,
    SchedulerCreate,
    SchedulerOut,
    SchedulerUpdate,
)
from app.services import job_scheduler

router = APIRouter()


def _to_out(s: Scheduler) -> SchedulerOut:
    devices = [
        DeviceBrief(id=sd.device.id, hostname=sd.device.hostname)
        for sd in s.scheduler_devices
        if sd.device
    ]
    return SchedulerOut(
        id=s.id,
        name=s.name,
        schedule_type=s.schedule_type,
        interval_value=s.interval_value,
        interval_unit=s.interval_unit,
        time_of_day=s.time_of_day,
        days_of_week=s.days_of_week,
        day_of_month=s.day_of_month,
        target_type=s.target_type,
        target_org_id=s.target_org_id,
        target_site_id=s.target_site_id,
        target_org_name=s.target_org.name if s.target_org else None,
        target_site_name=s.target_site.name if s.target_site else None,
        notification_email=s.notification_email,
        is_active=s.is_active,
        last_run_at=s.last_run_at,
        devices=devices,
    )


async def _load(scheduler_id: int, db: AsyncSession) -> Scheduler:
    result = await db.execute(
        select(Scheduler)
        .options(
            selectinload(Scheduler.scheduler_devices).selectinload(SchedulerDevice.device),
            selectinload(Scheduler.target_org),
            selectinload(Scheduler.target_site),
        )
        .where(Scheduler.id == scheduler_id)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scheduler bulunamadı")
    return s


@router.get("/", response_model=list[SchedulerOut])
async def list_schedulers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Scheduler).options(
            selectinload(Scheduler.scheduler_devices).selectinload(SchedulerDevice.device),
            selectinload(Scheduler.target_org),
            selectinload(Scheduler.target_site),
        )
    )
    return [_to_out(s) for s in result.scalars().all()]


@router.post("/", response_model=SchedulerOut, status_code=status.HTTP_201_CREATED)
async def create_scheduler(
    body: SchedulerCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    scheduler = Scheduler(
        name=body.name,
        schedule_type=body.schedule_type,
        interval_value=body.interval_value,
        interval_unit=body.interval_unit,
        time_of_day=body.time_of_day,
        days_of_week=body.days_of_week,
        day_of_month=body.day_of_month,
        target_type=body.target_type,
        target_org_id=body.target_org_id,
        target_site_id=body.target_site_id,
        notification_email=body.notification_email,
    )
    db.add(scheduler)
    await db.flush()

    if body.target_type == 'manual':
        for device_id in body.device_ids:
            db.add(SchedulerDevice(scheduler_id=scheduler.id, device_id=device_id))

    await db.commit()
    out = _to_out(await _load(scheduler.id, db))
    await job_scheduler.reload(scheduler.id)
    return out


@router.patch("/{scheduler_id}", response_model=SchedulerOut)
async def update_scheduler(
    scheduler_id: int,
    body: SchedulerUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    s = await _load(scheduler_id, db)

    update_data = body.model_dump(exclude_unset=True, exclude={'device_ids'})
    for key, val in update_data.items():
        setattr(s, key, val)

    if body.device_ids is not None:
        for sd in list(s.scheduler_devices):
            await db.delete(sd)
        await db.flush()
        for device_id in body.device_ids:
            db.add(SchedulerDevice(scheduler_id=s.id, device_id=device_id))

    await db.commit()
    out = _to_out(await _load(scheduler_id, db))
    await job_scheduler.reload(scheduler_id)
    return out


@router.delete("/{scheduler_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduler(
    scheduler_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    s = await _load(scheduler_id, db)
    job_scheduler.unregister(scheduler_id)
    await db.delete(s)
    await db.commit()
