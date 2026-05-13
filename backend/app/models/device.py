from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_uid = Column(String(12), unique=True, nullable=False, index=True)
    hostname = Column(String, nullable=False)
    ip_address = Column(String, nullable=False)
    vendor = Column(String, nullable=False)
    model = Column(String, nullable=True)
    version = Column(String, nullable=True)
    config_command = Column(String, nullable=False)
    ssh_username = Column(String, nullable=True)
    ssh_password = Column(String, nullable=True)
    status = Column(String, default="unknown")
    last_collected_at = Column(DateTime(timezone=True), nullable=True)

    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True)
    site = relationship("Site", back_populates="devices")

    scheduler_devices = relationship("SchedulerDevice", back_populates="device")
