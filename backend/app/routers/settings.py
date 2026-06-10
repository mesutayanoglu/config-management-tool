from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from github import Github, GithubException

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_admin_user, get_current_user
from app.models.user import User
from app.services.github_service import github_service

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


class SmtpSettings(BaseModel):
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""


class NotificationSettings(BaseModel):
    enabled: bool = False
    emails: str = ""


@router.get("/")
async def get_settings(_: User = Depends(get_current_user)):
    return {
        "github_token": "***" if settings.GITHUB_TOKEN else "",
        "github_repo": settings.GITHUB_REPO,
    }


@router.post("/")
async def save_settings(
    body: GithubSettings,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    token = body.github_token.strip()
    repo = normalize_repo(body.github_repo)

    if token and token != "***":
        settings.GITHUB_TOKEN = token
        await _upsert(db, "GITHUB_TOKEN", token)
        github_service.reset_client()

    if repo:
        settings.GITHUB_REPO = repo
        await _upsert(db, "GITHUB_REPO", repo)

    await db.commit()
    return {"status": "ok"}


@router.get("/test-github")
async def test_github(_: User = Depends(get_admin_user)):
    token = settings.GITHUB_TOKEN
    repo = normalize_repo(settings.GITHUB_REPO)
    if not token or not repo:
        raise HTTPException(status_code=400, detail="GitHub token veya repo ayarlanmamış")
    try:
        g = Github(token)
        r = g.get_repo(repo)
        return {"repo": r.full_name, "private": r.private}
    except GithubException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/smtp")
async def get_smtp_settings(_: User = Depends(get_current_user)):
    return {
        "smtp_host": settings.SMTP_HOST,
        "smtp_port": settings.SMTP_PORT,
        "smtp_user": settings.SMTP_USER,
        "smtp_password": "***" if settings.SMTP_PASSWORD else "",
        "smtp_from": settings.SMTP_FROM,
    }


@router.post("/smtp")
async def save_smtp_settings(
    body: SmtpSettings,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    await _upsert(db, "SMTP_HOST", body.smtp_host.strip())
    await _upsert(db, "SMTP_PORT", str(body.smtp_port))
    await _upsert(db, "SMTP_USER", body.smtp_user.strip())
    await _upsert(db, "SMTP_FROM", body.smtp_from.strip())

    if body.smtp_password and body.smtp_password != "***":
        await _upsert(db, "SMTP_PASSWORD", body.smtp_password)
        settings.SMTP_PASSWORD = body.smtp_password

    await db.commit()

    settings.SMTP_HOST = body.smtp_host.strip()
    settings.SMTP_PORT = body.smtp_port
    settings.SMTP_USER = body.smtp_user.strip()
    settings.SMTP_FROM = body.smtp_from.strip()

    return {"status": "ok"}


@router.get("/notifications")
async def get_notification_settings(_: User = Depends(get_current_user)):
    return {
        "enabled": settings.CHANGE_NOTIFY_ENABLED,
        "emails": settings.CHANGE_NOTIFY_EMAILS,
    }


@router.post("/notifications")
async def save_notification_settings(
    body: NotificationSettings,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    settings.CHANGE_NOTIFY_ENABLED = body.enabled
    settings.CHANGE_NOTIFY_EMAILS = body.emails.strip()
    await _upsert(db, "CHANGE_NOTIFY_ENABLED", str(body.enabled).lower())
    await _upsert(db, "CHANGE_NOTIFY_EMAILS", body.emails.strip())
    await db.commit()
    return {"status": "ok"}


@router.post("/test-smtp")
async def test_smtp(current_user: User = Depends(get_admin_user)):
    from app.services.email_service import send_test_email

    if not current_user.email:
        raise HTTPException(
            status_code=400,
            detail="Hesabınızda e-posta adresi tanımlı değil. Test maili gönderilemez.",
        )

    if not settings.SMTP_HOST or not settings.SMTP_FROM:
        raise HTTPException(status_code=400, detail="SMTP ayarları yapılandırılmamış")

    try:
        await send_test_email(current_user.email)
        return {"status": "ok", "sent_to": current_user.email}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Test e-postası gönderilemedi: {exc}")
