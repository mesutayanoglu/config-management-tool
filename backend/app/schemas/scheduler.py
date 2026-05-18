from datetime import datetime
from pydantic import BaseModel


class SchedulerCreate(BaseModel):
    name: str
    schedule_type: str = 'interval'   # interval | daily | weekly | monthly
    interval_value: int = 60
    interval_unit: str = 'minutes'    # minutes | hours
    time_of_day: str | None = None    # HH:MM
    days_of_week: str | None = None   # comma-separated 0-6
    day_of_month: int | None = None   # 1-31
    target_type: str = 'manual'       # manual | org | site
    target_org_id: int | None = None
    target_site_id: int | None = None
    device_ids: list[int] = []
    notification_email: str | None = None


class SchedulerUpdate(BaseModel):
    name: str | None = None
    schedule_type: str | None = None
    interval_value: int | None = None
    interval_unit: str | None = None
    time_of_day: str | None = None
    days_of_week: str | None = None
    day_of_month: int | None = None
    target_type: str | None = None
    target_org_id: int | None = None
    target_site_id: int | None = None
    device_ids: list[int] | None = None
    notification_email: str | None = None
    is_active: bool | None = None


class DeviceBrief(BaseModel):
    id: int
    hostname: str
    model_config = {"from_attributes": True}


class SchedulerOut(BaseModel):
    id: int
    name: str
    schedule_type: str
    interval_value: int
    interval_unit: str
    time_of_day: str | None
    days_of_week: str | None
    day_of_month: int | None
    target_type: str
    target_org_id: int | None
    target_site_id: int | None
    target_org_name: str | None
    target_site_name: str | None
    notification_email: str | None
    is_active: int
    last_run_at: datetime | None
    devices: list[DeviceBrief]
    model_config = {"from_attributes": True}
