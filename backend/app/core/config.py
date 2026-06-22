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

    # SSH defaults
    SSH_TIMEOUT: int = 30

    # SMTP (şifre sıfırlama e-postası için — opsiyonel)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # Değişiklik bildirimleri
    CHANGE_NOTIFY_ENABLED: bool = False
    CHANGE_NOTIFY_EMAILS: str = ""

    # Topoloji otomatik keşif
    TOPOLOGY_AUTO_ENABLED: bool = False
    TOPOLOGY_INTERVAL_HOURS: int = 6

    # Uygulama ortamı — 'development' modda SMTP olmadan token log'a yazılır
    ENVIRONMENT: str = "production"
    FRONTEND_URL: str = "http://localhost"

    # Bootstrap — ilk super_administrator oluşturmak için (opsiyonel)
    INITIAL_SUPERADMIN_USERNAME: str = ""
    INITIAL_SUPERADMIN_PASSWORD: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
