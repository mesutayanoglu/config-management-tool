import json
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import get_current_user, get_write_user
from app.models.credential_profile import CredentialProfile
from app.models.device import Device
from app.models.organization import Site, Organization  # modellerin kayıt sırası için
from app.models.restore_log import RestoreLog
from app.models.user import User
from app.schemas.device import DeviceCreate, DeviceOut, DeviceUpdate
from app.services.github_service import github_service as github
from app.services.ping_service import ping_device
from app.services.restore_strategies import get_restore_strategy, HUAWEI_REBOOT_WARNING
from app.services.ssh_collector import collect_config, collect_config_stream

router = APIRouter()


def _collect_error_detail(msg: str) -> str:
    if "401" in msg or "Bad credentials" in msg:
        return "GitHub token geçersiz. Ayarlar sayfasından token'ı güncelleyin."
    if "403" in msg or "not accessible" in msg:
        return "GitHub token'ının 'Contents: Read and Write' izni yok."
    if "404" in msg and "github" in msg.lower():
        return "GitHub reposu bulunamadı. Ayarlar sayfasından repo adını kontrol edin."
    if any(k in msg.lower() for k in ("authentication", "ssh", "socket", "connect", "timed out")):
        return f"Bağlantı kurulamadı: {msg[:120]}"
    return f"Config alınamadı: {msg[:200]}"


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
    except IntegrityError as exc:
        await db.rollback()
        msg = str(exc.orig).lower() if exc.orig else ""
        if "configlet_devices" in msg:
            detail = "configlet_conflict"
        else:
            detail = "scheduler_conflict"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


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
        raise HTTPException(status_code=500, detail=_collect_error_detail(str(exc)))

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


@router.post("/{device_id}/collect-stream")
async def collect_stream(
    device_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    """SSE: adım adım ilerleme olayları (connecting/fetched/saving/done) yollar.
    Kullanıcı işlem bitene kadar modalda kalır, süreç bir sayfa geçişiyle bölünmez."""
    result = await db.execute(
        select(Device).options(selectinload(Device.credential_profile))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cihaz bulunamadı")

    device_id_snap = device.id
    hostname_snap = device.hostname
    ip_snap = device.ip_address

    async def generate():
        result_data = None
        async for event in collect_config_stream(device):
            if event.get("type") == "done":
                if event.get("status") == "success":
                    result_data = event
                else:
                    event = {**event, "error": _collect_error_detail(event.get("error", ""))}
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        if result_data:
            try:
                async with AsyncSessionLocal() as save_db:
                    r = await save_db.execute(select(Device).where(Device.id == device_id_snap))
                    dev = r.scalar_one_or_none()
                    if dev:
                        if result_data.get("model"):
                            dev.model = result_data["model"]
                        if result_data.get("version"):
                            dev.version = result_data["version"]
                        dev.last_collected_at = datetime.now(timezone.utc)
                        await save_db.commit()

                        if result_data.get("changed"):
                            from app.services.email_service import send_config_change_notification
                            await send_config_change_notification(
                                hostname_snap, ip_snap,
                                result_data["old_content"], result_data["new_content"],
                            )
            except Exception:
                pass  # kayıt hatası akışı bozmasın; kullanıcı zaten "done" olayını gördü

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{device_id}/configs/{commit_sha}/restore")
async def restore_config(
    device_id: int,
    commit_sha: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_write_user),
):
    """Belirtilen GitHub commit'indeki config'i cihaza geri yükler (rollback).
    Restore'dan ÖNCE cihazın mevcut running-config'i GitHub'a yedeklenir
    (rollback'in de rollback'i mümkün olsun diye)."""
    result = await db.execute(
        select(Device).options(selectinload(Device.credential_profile))
        .where(Device.id == device_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cihaz bulunamadı")

    content = await github.get_config(device.device_uid, commit_sha)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config bulunamadı")

    started_at = datetime.now(ZoneInfo("Europe/Istanbul")).replace(tzinfo=None)
    start_ts = datetime.now(timezone.utc)

    def _duration_ms() -> int:
        return int((datetime.now(timezone.utc) - start_ts).total_seconds() * 1000)

    # 1) Ön yedekleme: cihaza dokunmadan önce mevcut running-config'i GitHub'a yedekle.
    try:
        await collect_config(device)
    except Exception as exc:
        detail = _collect_error_detail(str(exc))
        db.add(RestoreLog(
            device_id=device.id,
            device_hostname=device.hostname,
            device_ip=device.ip_address,
            triggered_by_id=current_user.id,
            triggered_by_username=current_user.username,
            target_sha=commit_sha,
            target_commit_message=None,
            backup_sha=None,
            status="failed",
            error=f"Ön yedekleme başarısız: {detail}"[:500],
            started_at=started_at,
            duration_ms=_duration_ms(),
        ))
        await db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Mevcut config yedeklenemediği için restore iptal edildi: {detail}",
        )

    configs = await github.list_configs(device.device_uid)
    backup_sha = configs[0]["sha"] if configs else None
    target_commit_message = next(
        (c["message"] for c in configs if c["sha"] == commit_sha), None
    )

    # 2) Vendor'a uygun restore stratejisini bul.
    strategy = get_restore_strategy(device.vendor)
    if strategy is None:
        raise HTTPException(
            status_code=400,
            detail="Bu cihaz vendor'ı için restore desteklenmiyor",
        )

    # 3) Config'i cihaza uygula.
    try:
        restore_log_output = await strategy.restore(device, content)
    except Exception as exc:
        detail = _collect_error_detail(str(exc))
        db.add(RestoreLog(
            device_id=device.id,
            device_hostname=device.hostname,
            device_ip=device.ip_address,
            triggered_by_id=current_user.id,
            triggered_by_username=current_user.username,
            target_sha=commit_sha,
            target_commit_message=target_commit_message,
            backup_sha=backup_sha,
            status="failed",
            error=str(exc)[:500],
            started_at=started_at,
            duration_ms=_duration_ms(),
        ))
        await db.commit()
        raise HTTPException(status_code=500, detail=detail)

    warning_parts: list[str] = []
    if "[UYARI]" in restore_log_output:
        warning_parts.append(HUAWEI_REBOOT_WARNING)

    # 4) Doğrulama: cihazın restore sonrası running-config'ini tekrar çek + commit et.
    #    Bu adım başarısız olsa bile restore işlemi BAŞARISIZ SAYILMAZ (cihaz zaten değişti).
    try:
        post_result = await collect_config(device)
        if post_result.get("model"):
            device.model = post_result["model"]
        if post_result.get("version"):
            device.version = post_result["version"]
        device.last_collected_at = datetime.now(timezone.utc)
    except Exception as exc:
        warning_parts.append(
            f"Restore uygulandı ancak doğrulama yedeği alınamadı: {_collect_error_detail(str(exc))}"
        )

    db.add(RestoreLog(
        device_id=device.id,
        device_hostname=device.hostname,
        device_ip=device.ip_address,
        triggered_by_id=current_user.id,
        triggered_by_username=current_user.username,
        target_sha=commit_sha,
        target_commit_message=target_commit_message,
        backup_sha=backup_sha,
        status="success",
        error=None,
        started_at=started_at,
        duration_ms=_duration_ms(),
    ))
    await db.commit()

    return {
        "status": "success",
        "device_id": device_id,
        "restored_from": commit_sha,
        "backup_sha": backup_sha,
        "warning": " ".join(warning_parts) if warning_parts else None,
    }
