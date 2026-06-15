from datetime import datetime
from typing import Any
from pydantic import BaseModel


class DeviceBrief(BaseModel):
    id: int
    hostname: str
    ip_address: str
    vendor: str
    status: str

    model_config = {"from_attributes": True}


class ConfigletCreate(BaseModel):
    name: str
    description: str | None = None
    content: str
    device_ids: list[int] = []
    variable_defaults: dict[str, str] = {}
    schedule_enabled: bool = False
    schedule_type: str | None = None
    interval_value: int | None = None
    interval_unit: str | None = None
    time_of_day: str | None = None
    days_of_week: str | None = None
    day_of_month: int | None = None
    notification_email: str | None = None


class ConfigletUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    device_ids: list[int] | None = None
    variable_defaults: dict[str, str] | None = None
    schedule_enabled: bool | None = None
    schedule_type: str | None = None
    interval_value: int | None = None
    interval_unit: str | None = None
    time_of_day: str | None = None
    days_of_week: str | None = None
    day_of_month: int | None = None
    notification_email: str | None = None


class ConfigletOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    content: str
    variables: list[str]
    variable_defaults: dict[str, str]
    device_ids: list[int]
    devices: list[DeviceBrief]
    schedule_enabled: bool
    schedule_type: str | None = None
    interval_value: int | None = None
    interval_unit: str | None = None
    time_of_day: str | None = None
    days_of_week: str | None = None
    day_of_month: int | None = None
    last_run_at: datetime | None = None
    notification_email: str | None = None
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class DeviceExecuteResult(BaseModel):
    device_id: int
    hostname: str
    ip_address: str
    status: str  # success | failed
    output: str | None = None
    error: str | None = None
    duration_ms: int


class ConfigletExecuteRequest(BaseModel):
    device_ids: list[int]
    variables: dict[str, str] = {}


class ConfigletExecutionOut(BaseModel):
    id: int
    configlet_id: int | None
    configlet_name: str
    triggered_by_id: int | None
    triggered_by_username: str | None
    trigger_type: str
    started_at: datetime
    total_devices: int
    ok_count: int
    fail_count: int
    device_results: list[Any] | None

    model_config = {"from_attributes": True}
