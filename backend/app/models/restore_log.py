from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class RestoreLog(Base):
    __tablename__ = "restore_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    device_hostname = Column(String, nullable=False)   # snapshot (cihaz sonradan silinebilir)
    device_ip = Column(String, nullable=True)
    triggered_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    triggered_by_username = Column(String, nullable=True)
    target_sha = Column(String, nullable=False)
    target_commit_message = Column(String, nullable=True)
    backup_sha = Column(String, nullable=True)
    status = Column(String(16), nullable=False)  # 'success' | 'failed'
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=False)  # Istanbul naive (bkz. CLAUDE.md timezone kuralı)
    duration_ms = Column(Integer, nullable=True)
