from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings as app_settings
from app.core.database import engine
from app.routers import auth, devices, configs, schedulers, organizations, settings, credential_profiles, configlets, topology
from app.services import job_scheduler, configlet_scheduler


async def _load_settings_from_db():
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS site_settings (
                key VARCHAR PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
            )
        """))
        result = await conn.execute(text("SELECT key, value FROM site_settings"))
        rows = result.fetchall()
    for row in rows:
        if row[0] == "GITHUB_TOKEN":
            app_settings.GITHUB_TOKEN = row[1]
        elif row[0] == "GITHUB_REPO":
            app_settings.GITHUB_REPO = row[1]
        elif row[0] == "SMTP_HOST":
            app_settings.SMTP_HOST = row[1]
        elif row[0] == "SMTP_PORT":
            try:
                app_settings.SMTP_PORT = int(row[1])
            except ValueError:
                pass
        elif row[0] == "SMTP_USER":
            app_settings.SMTP_USER = row[1]
        elif row[0] == "SMTP_PASSWORD":
            app_settings.SMTP_PASSWORD = row[1]
        elif row[0] == "SMTP_FROM":
            app_settings.SMTP_FROM = row[1]
        elif row[0] == "CHANGE_NOTIFY_ENABLED":
            app_settings.CHANGE_NOTIFY_ENABLED = row[1].lower() == 'true'
        elif row[0] == "CHANGE_NOTIFY_EMAILS":
            app_settings.CHANGE_NOTIFY_EMAILS = row[1]
        elif row[0] == "TOPOLOGY_AUTO_ENABLED":
            app_settings.TOPOLOGY_AUTO_ENABLED = row[1].lower() == 'true'
        elif row[0] == "TOPOLOGY_INTERVAL_HOURS":
            try:
                app_settings.TOPOLOGY_INTERVAL_HOURS = int(row[1])
            except ValueError:
                pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _load_settings_from_db()
    await job_scheduler.start()
    await configlet_scheduler.start()
    if app_settings.TOPOLOGY_AUTO_ENABLED:
        job_scheduler.schedule_topology_discovery(app_settings.TOPOLOGY_INTERVAL_HOURS)
    yield
    job_scheduler.stop()


app = FastAPI(
    title="Network Configuration Management Tool",
    version="1.0.0",
    description="FortiGate, Aruba CX, Huawei, Cisco cihazlarının konfigürasyonlarını yöneten araç",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(devices.router, prefix="/devices", tags=["devices"])
app.include_router(configs.router, prefix="/configs", tags=["configs"])
app.include_router(schedulers.router, prefix="/schedulers", tags=["schedulers"])
app.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
app.include_router(settings.router, prefix="/settings", tags=["settings"])
app.include_router(credential_profiles.router, prefix="/credential-profiles", tags=["credential-profiles"])
app.include_router(configlets.router, prefix="/configlets", tags=["configlets"])
app.include_router(topology.router, prefix="/topology", tags=["topology"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
