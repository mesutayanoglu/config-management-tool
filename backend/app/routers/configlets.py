import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, get_write_user
from app.models.configlet import Configlet, ConfigletDevice
from app.models.device import Device
from app.models.user import User
from app.schemas.configlet import (
    ConfigletCreate,
    ConfigletExecuteRequest,
    ConfigletOut,
    ConfigletUpdate,
    DeviceBrief,
    DeviceExecuteResult,
)
from app.services.configlet_service import (
    execute_on_device,
    execute_on_device_streaming,
    extract_variables,
    render_template,
)
from app.services import configlet_scheduler
from app.services.email_service import send_configlet_notification

router = APIRouter()


def _parse_defaults(c: Configlet) -> dict:
    if c.variable_defaults:
        try:
            return json.loads(c.variable_defaults)
        except Exception:
            return {}
    return {}


def _to_out(c: Configlet) -> ConfigletOut:
    devices = [cd.device for cd in c.configlet_devices if cd.device]
    return ConfigletOut(
        id=c.id,
        name=c.name,
        description=c.description,
        content=c.content,
        variables=extract_variables(c.content),
        variable_defaults=_parse_defaults(c),
        device_ids=[d.id for d in devices],
        devices=[
            DeviceBrief(
                id=d.id,
                hostname=d.hostname,
                ip_address=d.ip_address,
                vendor=d.vendor,
                status=d.status or "unknown",
            )
            for d in devices
        ],
        schedule_enabled=bool(c.schedule_enabled),
        schedule_type=c.schedule_type,
        interval_value=c.interval_value,
        interval_unit=c.interval_unit,
        time_of_day=c.time_of_day,
        days_of_week=c.days_of_week,
        day_of_month=c.day_of_month,
        last_run_at=c.last_run_at,
        notification_email=c.notification_email,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


async def _load(configlet_id: int, db: AsyncSession) -> Configlet:
    result = await db.execute(
        select(Configlet)
        .options(
            selectinload(Configlet.configlet_devices).selectinload(ConfigletDevice.device)
        )
        .where(Configlet.id == configlet_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Configlet bulunamadı")
    return c


@router.get("/", response_model=list[ConfigletOut])
async def list_configlets(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Configlet)
        .options(
            selectinload(Configlet.configlet_devices).selectinload(ConfigletDevice.device)
        )
        .order_by(Configlet.name)
    )
    return [_to_out(c) for c in result.scalars().all()]


@router.post("/", response_model=ConfigletOut, status_code=status.HTTP_201_CREATED)
async def create_configlet(
    body: ConfigletCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    c = Configlet(
        name=body.name,
        description=body.description,
        content=body.content,
        variable_defaults=json.dumps(body.variable_defaults) if body.variable_defaults else None,
        schedule_enabled=body.schedule_enabled,
        schedule_type=body.schedule_type,
        interval_value=body.interval_value,
        interval_unit=body.interval_unit,
        time_of_day=body.time_of_day,
        days_of_week=body.days_of_week,
        day_of_month=body.day_of_month,
        notification_email=body.notification_email,
    )
    db.add(c)
    await db.flush()

    for device_id in body.device_ids:
        db.add(ConfigletDevice(configlet_id=c.id, device_id=device_id))

    await db.commit()
    out = _to_out(await _load(c.id, db))
    await configlet_scheduler.reload(c.id)
    return out


@router.get("/{configlet_id}", response_model=ConfigletOut)
async def get_configlet(
    configlet_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _to_out(await _load(configlet_id, db))


@router.patch("/{configlet_id}", response_model=ConfigletOut)
async def update_configlet(
    configlet_id: int,
    body: ConfigletUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    c = await _load(configlet_id, db)

    update_data = body.model_dump(exclude_unset=True, exclude={"device_ids", "variable_defaults"})
    for key, val in update_data.items():
        setattr(c, key, val)

    if body.variable_defaults is not None:
        c.variable_defaults = json.dumps(body.variable_defaults) if body.variable_defaults else None

    if body.device_ids is not None:
        for cd in list(c.configlet_devices):
            await db.delete(cd)
        await db.flush()
        for device_id in body.device_ids:
            db.add(ConfigletDevice(configlet_id=c.id, device_id=device_id))

    await db.commit()
    out = _to_out(await _load(configlet_id, db))
    await configlet_scheduler.reload(c.id)
    return out


@router.delete("/{configlet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_configlet(
    configlet_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    c = await _load(configlet_id, db)
    configlet_scheduler.unregister(configlet_id)
    await db.delete(c)
    await db.commit()


@router.post("/{configlet_id}/execute", response_model=list[DeviceExecuteResult])
async def execute_configlet(
    configlet_id: int,
    body: ConfigletExecuteRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    c = await _load(configlet_id, db)

    try:
        rendered = render_template(c.content, body.variables)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Şablon render hatası: {e}")

    result = await db.execute(
        select(Device)
        .options(selectinload(Device.credential_profile))
        .where(Device.id.in_(body.device_ids))
    )
    devices = result.scalars().all()

    if not devices:
        raise HTTPException(status_code=400, detail="Seçilen cihazlar bulunamadı")

    tasks = [execute_on_device(device, rendered) for device in devices]
    results = await asyncio.gather(*tasks)

    return [DeviceExecuteResult(**r) for r in results]


@router.post("/{configlet_id}/execute-stream")
async def execute_configlet_stream(
    configlet_id: int,
    body: ConfigletExecuteRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    c = await _load(configlet_id, db)

    try:
        rendered = render_template(c.content, body.variables)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Şablon render hatası: {e}")

    result = await db.execute(
        select(Device)
        .options(selectinload(Device.credential_profile))
        .where(Device.id.in_(body.device_ids))
    )
    devices = result.scalars().all()

    if not devices:
        raise HTTPException(status_code=400, detail="Seçilen cihazlar bulunamadı")

    # Snapshot data needed — DB session closes after this coroutine returns,
    # so the generator must not use `db`.
    device_list = list(devices)
    rendered_content = rendered
    notification_email = c.notification_email
    configlet_name = c.name

    async def generate():
        from datetime import datetime
        from zoneinfo import ZoneInfo

        total = len(device_list)
        ok_count = 0
        fail_count = 0
        exec_results = []

        for device in device_list:
            async for event in execute_on_device_streaming(device, rendered_content):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("type") == "done":
                    if event.get("status") == "success":
                        ok_count += 1
                    else:
                        fail_count += 1
                    exec_results.append(event)

        yield f"data: {json.dumps({'type': 'complete', 'total': total, 'ok': ok_count, 'failed': fail_count}, ensure_ascii=False)}\n\n"

        if notification_email:
            run_at = datetime.now(ZoneInfo("Europe/Istanbul")).strftime("%d.%m.%Y %H:%M")
            await send_configlet_notification(notification_email, configlet_name, run_at, exec_results)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # prevent Nginx buffering
        },
    )
