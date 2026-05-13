from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings as app_settings
from app.core.database import engine
from app.routers import auth, devices, configs, schedulers, organizations, settings
from app.services import job_scheduler


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _load_settings_from_db()
    await job_scheduler.start()
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


@app.get("/health")
def health_check():
    return {"status": "ok"}
