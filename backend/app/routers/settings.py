from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from github import Github, GithubException

from app.core.config import settings
from app.core.database import get_db

router = APIRouter()


def normalize_repo(repo: str) -> str:
    repo = repo.strip().rstrip("/")
    for prefix in ("https://github.com/", "http://github.com/", "github.com/"):
        if repo.startswith(prefix):
            repo = repo[len(prefix):]
            break
    return repo


async def _upsert(db: AsyncSession, key: str, value: str):
    await db.execute(
        text("""
            INSERT INTO site_settings (key, value) VALUES (:key, :value)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """),
        {"key": key, "value": value},
    )


class GithubSettings(BaseModel):
    github_token: str
    github_repo: str


@router.get("/")
async def get_settings():
    return {
        "github_token": "***" if settings.GITHUB_TOKEN else "",
        "github_repo": settings.GITHUB_REPO,
    }


@router.post("/")
async def save_settings(body: GithubSettings, db: AsyncSession = Depends(get_db)):
    token = body.github_token.strip()
    repo = normalize_repo(body.github_repo)

    # "***" gönderilirse mevcut token'ı koru
    if token and token != "***":
        settings.GITHUB_TOKEN = token
        await _upsert(db, "GITHUB_TOKEN", token)

    if repo:
        settings.GITHUB_REPO = repo
        await _upsert(db, "GITHUB_REPO", repo)

    await db.commit()
    return {"status": "ok"}


@router.get("/test-github")
async def test_github():
    token = settings.GITHUB_TOKEN
    repo = normalize_repo(settings.GITHUB_REPO)
    if not token or not repo:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="GitHub token veya repo ayarlanmamış")
    try:
        g = Github(token)
        r = g.get_repo(repo)
        return {"repo": r.full_name, "private": r.private}
    except GithubException as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
