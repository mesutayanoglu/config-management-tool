import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.security import get_current_user, get_super_admin_user, get_write_user
from app.models.device import Device
from app.models.topology import TopologyNeighbor
from app.models.user import User

router = APIRouter()


class TopologySettingsIn(BaseModel):
    auto_enabled: bool
    interval_hours: int


@router.post("/discover")
async def discover(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    from app.services.lldp_collector import discover_neighbors

    result = await db.execute(
        select(Device).options(selectinload(Device.credential_profile))
    )
    devices = result.scalars().all()

    if not devices:
        return {"discovered": 0, "failed": 0}

    success = 0
    failed = 0

    for device in devices:
        try:
            neighbors = await discover_neighbors(device)

            await db.execute(
                delete(TopologyNeighbor).where(TopologyNeighbor.device_id == device.id)
            )
            await db.flush()

            now = datetime.utcnow()
            for n in neighbors:
                neighbor_ip = n.get("neighbor_ip")
                discovered_device_id = None

                if neighbor_ip:
                    res = await db.execute(
                        select(Device.id).where(Device.ip_address == neighbor_ip)
                    )
                    row = res.scalar_one_or_none()
                    if row is not None:
                        discovered_device_id = row

                db.add(TopologyNeighbor(
                    device_id=device.id,
                    neighbor_hostname=n.get("neighbor_hostname"),
                    neighbor_ip=neighbor_ip,
                    local_port=n.get("local_port"),
                    neighbor_port=n.get("neighbor_port"),
                    protocol=n.get("protocol", "lldp"),
                    discovered_device_id=discovered_device_id,
                    last_discovered_at=now,
                ))

            await db.commit()
            success += 1

        except Exception:
            await db.rollback()
            failed += 1

    return {"discovered": success, "failed": failed}


@router.get("/graph")
async def get_graph(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TopologyNeighbor).options(
            selectinload(TopologyNeighbor.device),
            selectinload(TopologyNeighbor.discovered_device),
        )
    )
    neighbors = result.scalars().all()

    result = await db.execute(select(Device))
    all_devices = {d.id: d for d in result.scalars().all()}

    nodes_dict: dict[str, dict] = {}
    edges: list[dict] = []
    seen_edges: set[tuple] = set()

    # Tüm DB cihazlarını her zaman node olarak ekle (komşusu olmasa bile)
    for d in all_devices.values():
        node_id = f"d_{d.id}"
        nodes_dict[node_id] = {
            "id": node_id,
            "type": "deviceNode",
            "data": {
                "hostname": d.hostname,
                "ip": d.ip_address,
                "vendor": d.vendor,
                "known": True,
                "device_id": d.id,
            },
            "position": {"x": 0, "y": 0},
        }

    for n in neighbors:
        source_id = f"d_{n.device_id}"

        if n.discovered_device_id:
            target_id = f"d_{n.discovered_device_id}"
        else:
            ghost_key = n.neighbor_ip or n.neighbor_hostname or str(n.id)
            target_id = f"g_{ghost_key}"
            if target_id not in nodes_dict:
                nodes_dict[target_id] = {
                    "id": target_id,
                    "type": "deviceNode",
                    "data": {
                        "hostname": n.neighbor_hostname or "?",
                        "ip": n.neighbor_ip or "?",
                        "vendor": None,
                        "known": False,
                        "neighbor_id": n.id,
                    },
                    "position": {"x": 0, "y": 0},
                }

        if source_id == target_id:
            continue

        edge_pair = tuple(sorted([source_id, target_id]))
        if edge_pair not in seen_edges:
            seen_edges.add(edge_pair)
            edges.append({
                "id": f"e_{n.id}",
                "source": source_id,
                "target": target_id,
                "type": "deviceEdge",
                "data": {
                    "local_port": n.local_port,
                    "neighbor_port": n.neighbor_port,
                    "protocol": n.protocol,
                    "neighbor_id": n.id,
                },
            })

    node_list = list(nodes_dict.values())
    count = len(node_list)
    if count > 0:
        radius = max(250, count * 55)
        for i, node in enumerate(node_list):
            angle = (2 * math.pi * i) / count
            node["position"] = {
                "x": round(radius * math.cos(angle) + 500),
                "y": round(radius * math.sin(angle) + 350),
            }

    return {"nodes": node_list, "edges": edges}


@router.get("/neighbors")
async def list_neighbors(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TopologyNeighbor)
        .options(selectinload(TopologyNeighbor.device))
        .order_by(TopologyNeighbor.device_id, TopologyNeighbor.id)
    )
    neighbors = result.scalars().all()
    return [
        {
            "id": n.id,
            "device_id": n.device_id,
            "device_hostname": n.device.hostname if n.device else None,
            "neighbor_hostname": n.neighbor_hostname,
            "neighbor_ip": n.neighbor_ip,
            "local_port": n.local_port,
            "neighbor_port": n.neighbor_port,
            "protocol": n.protocol,
            "discovered_device_id": n.discovered_device_id,
            "last_discovered_at": n.last_discovered_at.isoformat() if n.last_discovered_at else None,
        }
        for n in neighbors
    ]


@router.delete("/neighbors/{neighbor_id}", status_code=204)
async def delete_neighbor(
    neighbor_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(
        select(TopologyNeighbor).where(TopologyNeighbor.id == neighbor_id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Komşu bulunamadı")
    await db.delete(nb)
    await db.commit()


@router.get("/settings")
async def get_settings(
    _: User = Depends(get_current_user),
):
    return {
        "auto_enabled": app_settings.TOPOLOGY_AUTO_ENABLED,
        "interval_hours": app_settings.TOPOLOGY_INTERVAL_HOURS,
    }


@router.put("/settings")
async def save_settings(
    body: TopologySettingsIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_super_admin_user),
):
    from app.services import job_scheduler

    auto_enabled = body.auto_enabled
    interval_hours = max(1, body.interval_hours)

    app_settings.TOPOLOGY_AUTO_ENABLED = auto_enabled
    app_settings.TOPOLOGY_INTERVAL_HOURS = interval_hours

    for key, value in [
        ("TOPOLOGY_AUTO_ENABLED", str(auto_enabled).lower()),
        ("TOPOLOGY_INTERVAL_HOURS", str(interval_hours)),
    ]:
        await db.execute(
            text(
                "INSERT INTO site_settings (key, value) VALUES (:key, :value) "
                "ON CONFLICT (key) DO UPDATE SET value = :value"
            ),
            {"key": key, "value": value},
        )
    await db.commit()

    if auto_enabled:
        job_scheduler.schedule_topology_discovery(interval_hours)
    else:
        job_scheduler.unschedule_topology_discovery()

    return {"auto_enabled": auto_enabled, "interval_hours": interval_hours}
