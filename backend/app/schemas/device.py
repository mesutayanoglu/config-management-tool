from datetime import datetime
from pydantic import BaseModel


class DeviceCreate(BaseModel):
    hostname: str
    ip_address: str
    vendor: str
    config_command: str
    ssh_username: str | None = None
    ssh_password: str | None = None
    site_id: int | None = None


class DeviceUpdate(BaseModel):
    hostname: str | None = None
    ip_address: str | None = None
    vendor: str | None = None
    model: str | None = None
    version: str | None = None
    config_command: str | None = None
    ssh_username: str | None = None
    ssh_password: str | None = None
    site_id: int | None = None


class DeviceOut(BaseModel):
    id: int
    device_uid: str
    hostname: str
    ip_address: str
    vendor: str
    model: str | None
    version: str | None
    config_command: str
    status: str
    site_id: int | None
    last_collected_at: datetime | None
    site_name: str | None = None
    org_name: str | None = None
    org_id: int | None = None

    model_config = {"from_attributes": True}
