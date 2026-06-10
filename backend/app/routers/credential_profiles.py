import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_write_user
from app.models.credential_profile import CredentialProfile
from app.models.user import User
from app.schemas.credential_profile import (
    CredentialProfileCreate,
    CredentialProfileOut,
    CredentialProfileUpdate,
)

router = APIRouter()


def _out(p: CredentialProfile) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "connection_type": p.connection_type or "ssh",
        "username": p.username,
        "port": p.port,
        "enable_secret": "***" if p.enable_secret else None,
        "kex_algs": json.loads(p.kex_algs) if p.kex_algs else None,
        "host_key_algs": json.loads(p.host_key_algs) if p.host_key_algs else None,
        "cipher_algs": json.loads(p.cipher_algs) if p.cipher_algs else None,
    }


@router.get("/", response_model=list[CredentialProfileOut])
async def list_profiles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CredentialProfile).order_by(CredentialProfile.name)
    )
    return [_out(p) for p in result.scalars().all()]


@router.post("/", response_model=CredentialProfileOut, status_code=status.HTTP_201_CREATED)
async def create_profile(
    body: CredentialProfileCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    p = CredentialProfile(
        name=body.name.strip(),
        description=body.description,
        connection_type=body.connection_type,
        username=body.username,
        password=body.password,
        port=body.port,
        enable_secret=body.enable_secret or None,
        kex_algs=json.dumps(body.kex_algs) if body.kex_algs else None,
        host_key_algs=json.dumps(body.host_key_algs) if body.host_key_algs else None,
        cipher_algs=json.dumps(body.cipher_algs) if body.cipher_algs else None,
    )
    db.add(p)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Bu isimde bir profil zaten var.")
    await db.refresh(p)
    return _out(p)


@router.patch("/{profile_id}", response_model=CredentialProfileOut)
async def update_profile(
    profile_id: int,
    body: CredentialProfileUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(
        select(CredentialProfile).where(CredentialProfile.id == profile_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Profil bulunamadı.")

    data = body.model_dump(exclude_unset=True)
    # *** gönderilirse mevcut değeri koru
    if data.get("enable_secret") == "***":
        data.pop("enable_secret")
    elif "enable_secret" in data:
        data["enable_secret"] = data["enable_secret"] or None
    for field in ("kex_algs", "host_key_algs", "cipher_algs"):
        if field in data:
            data[field] = json.dumps(data[field]) if data[field] else None
    for field, value in data.items():
        setattr(p, field, value)

    await db.commit()
    await db.refresh(p)
    return _out(p)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_write_user),
):
    result = await db.execute(
        select(CredentialProfile).where(CredentialProfile.id == profile_id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Profil bulunamadı.")
    await db.delete(p)
    await db.commit()
