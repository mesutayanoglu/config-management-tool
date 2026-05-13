from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/configdb"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # GitHub
    GITHUB_TOKEN: str = ""
    GITHUB_REPO: str = ""  # örn: "kullaniciadi/config-backups"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # SSH defaults
    SSH_TIMEOUT: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
