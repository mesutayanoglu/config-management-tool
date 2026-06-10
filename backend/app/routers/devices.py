import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, get_write_user
from app.models.credential_profile import CredentialProfile
from app.models.device import Device
from app.models.organization import Site, Organization  # modellerin kayıt sırası için
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceOut, DeviceUpdate
from app.services.ping_service import ping_device
from app.services.ssh_collector import collect_config

router = APIRouter()


def _device_out(device: Device) -> DeviceOut:
    site_name = org_name = org_id = None
    if device.site:
        site_name = device.site.name
        if device.site.organization:
            org_name = device.site.organization.name
            org_id = device.site.organization.id
    profile_name = device.credential_profile.name if device.credential_profile else None
    return DeviceOut(
        id=device.id,
        device_uid=device.device_uid,
        hostname=device.hostname,
        ip_address=device.ip_address,
        vendor=device.vendor,
        model=device.model,
        version=device.version,
        config_command=device.config_command,
        status=device.status,
        site_id=device.site_id,
        last_collected_at=device.last_collected_at,
        site_name=site_name,
        org_name=org_name,
        org_id=org_id,
        credential_profile_id=device.credential_profile_id,
        credential_profile_name=profile_name,
    )


def _with_relations():
    return select(Device).options(
        selectinload(Device.site).selectinload(Site.organization),
        selectinload(Device.credential_profile),
    )


@router.get("/", response_model=list[DeviceOut])
async def list_devices(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(_with_relations())
    return [_device_out(d) for d in result.scalars().all()]


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(_with_relations().where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cihaz bulunamadı")
    return _device_out(device)


@router.post("/", response_model=DeviceOut, status_code=status.HTTP_201_CREATED)
async def create_device(
    body: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    device = Device(**body.model_dump(), device_uid=uuid.uuid4().hex[:12])
    db.add(device)
    await db.commit()
    result = await db.execute(_with_relations().where(Device.id == device.id))
    return _device_out(result.scalar_one())


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: int,
    body: DeviceUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cihaz bulunamadı")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(device, field, value)
    await db.commit()
    result = await db.execute(_with_relations().where(Device.id == device_id))
    return _device_out(result.scalar_one())


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cihaz bulunamadı")
    try:
        await db.delete(device)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="scheduler_conflict",
        )


@router.post("/{device_id}/ping")
async def ping(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cihaz bulunamadı")
    is_online = await ping_device(device.ip_address)
    device.status = "online" if is_online else "offline"
    await db.commit()
    return {"device_id": device_id, "status": device.status}


@router.post("/{device_id}/collect")
async def collect(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(
        select(Device).options(selectinload(Device.credential_profile))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cihaz bulunamadı")
    try:
        result_data = await collect_config(device)
    except Exception as exc:
        msg = str(exc)
        if "401" in msg or "Bad credentials" in msg:
            detail = "GitHub token geçersiz. Ayarlar sayfasından token'ı güncelleyin."
        elif "403" in msg or "not accessible" in msg:
            detail = "GitHub token'ının 'Contents: Read and Write' izni yok."
        elif "404" in msg and "github" in msg.lower():
            detail = "GitHub reposu bulunamadı. Ayarlar sayfasından repo adını kontrol edin."
        elif any(k in msg.lower() for k in ("authentication", "ssh", "socket", "connect", "timed out")):
            detail = f"SSH bağlantısı kurulamadı: {msg[:120]}"
        else:
            detail = f"Config alınamadı: {msg[:200]}"
        raise HTTPException(status_code=500, detail=detail)

    if result_data.get("model"):
        device.model = result_data["model"]
    if result_data.get("version"):
        device.version = result_data["version"]
    device.last_collected_at = datetime.now(timezone.utc)
    await db.commit()

    if result_data.get("changed"):
        from app.services.email_service import send_config_change_notification
        await send_config_change_notification(
            device.hostname,
            device.ip_address,
            result_data["old_content"],
            result_data["new_content"],
        )

    return {
        "device_id": device_id,
        "github_path": result_data["github_path"],
        "model": device.model,
        "version": device.version,
        "last_collected_at": device.last_collected_at.isoformat(),
    }
