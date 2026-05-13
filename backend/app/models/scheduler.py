from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class Scheduler(Base):
    __tablename__ = "schedulers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)

    # Schedule type: interval | daily | weekly | monthly
    schedule_type = Column(String, nullable=False, default='interval')
    interval_value = Column(Integer, nullable=False, default=60)
    interval_unit = Column(String, nullable=False, default='minutes')  # minutes | hours
    time_of_day = Column(String, nullable=True)   # HH:MM
    days_of_week = Column(String, nullable=True)  # comma-separated 0-6 (Mon=0)
    day_of_month = Column(Integer, nullable=True)  # 1-31

    # Target type: manual | org | site
    target_type = Column(String, nullable=False, default='manual')
    target_org_id = Column(Integer, ForeignKey('organizations.id'), nullable=True)
    target_site_id = Column(Integer, ForeignKey('sites.id'), nullable=True)

    is_active = Column(Integer, default=1)
    last_run_at = Column(DateTime, nullable=True)

    scheduler_devices = relationship(
        "SchedulerDevice", back_populates="scheduler", cascade="all, delete-orphan"
    )
    target_org = relationship("Organization", foreign_keys=[target_org_id])
    target_site = relationship("Site", foreign_keys=[target_site_id])


class SchedulerDevice(Base):
    __tablename__ = "scheduler_devices"

    id = Column(Integer, primary_key=True, index=True)
    scheduler_id = Column(Integer, ForeignKey("schedulers.id"), nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)

    scheduler = relationship("Scheduler", back_populates="scheduler_devices")
    device = relationship("Device", back_populates="scheduler_devices")
