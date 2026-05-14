from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user
from app.models.user import User
from app.services.github_service import GitHubService

router = APIRouter()
github = GitHubService()


@router.get("/")
async def list_configs(
    device_uid: str = Query(..., description="Cihaz UID'si"),
    _: User = Depends(get_current_user),
):
    configs = await github.list_configs(device_uid)
    return {"device_uid": device_uid, "configs": configs}


@router.get("/{device_uid}/at")
async def get_config_at_sha(
    device_uid: str,
    sha: str = Query(...),
    _: User = Depends(get_current_user),
):
    content = await github.get_config(device_uid, sha)
    if content is None:
        raise HTTPException(status_code=404, detail="Config bulunamadı")
    return {"device_uid": device_uid, "sha": sha, "content": content}


@router.get("/{device_uid}/latest")
async def get_latest_config(
    device_uid: str,
    _: User = Depends(get_current_user),
):
    content = await github.get_config(device_uid)
    if content is None:
        raise HTTPException(status_code=404, detail="Config bulunamadı")
    return {"device_uid": device_uid, "content": content}


@router.get("/{device_uid}/compare")
async def compare_configs(
    device_uid: str,
    sha_a: str = Query(...),
    sha_b: str = Query(...),
    _: User = Depends(get_current_user),
):
    content_a = await github.get_config(device_uid, sha_a) or ""
    content_b = await github.get_config(device_uid, sha_b) or ""
    return {"sha_a": sha_a, "sha_b": sha_b, "content_a": content_a, "content_b": content_b}
