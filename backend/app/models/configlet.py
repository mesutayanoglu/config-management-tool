from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Configlet(Base):
    __tablename__ = "configlets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    variable_defaults = Column(Text, nullable=True)  # JSON string: {"var": "default"}

    # Schedule fields
    schedule_enabled = Column(Boolean, default=False, nullable=False)
    schedule_type = Column(String, nullable=True)     # interval | daily | weekly | monthly
    interval_value = Column(Integer, nullable=True)
    interval_unit = Column(String, nullable=True)     # minutes | hours
    time_of_day = Column(String, nullable=True)       # HH:MM
    days_of_week = Column(String, nullable=True)      # comma-separated 0-6
    day_of_month = Column(Integer, nullable=True)     # 1-31
    last_run_at = Column(DateTime, nullable=True)
    notification_email = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    configlet_devices = relationship(
        "ConfigletDevice", back_populates="configlet", cascade="all, delete-orphan"
    )


class ConfigletDevice(Base):
    __tablename__ = "configlet_devices"

    id = Column(Integer, primary_key=True, index=True)
    configlet_id = Column(Integer, ForeignKey("configlets.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)

    configlet = relationship("Configlet", back_populates="configlet_devices")
    device = relationship("Device")
