from pydantic import BaseModel


class OrganizationCreate(BaseModel):
    name: str
    description: str | None = None


class OrganizationOut(BaseModel):
    id: int
    name: str
    description: str | None
    sites: list["SiteOut"] = []

    model_config = {"from_attributes": True}


class SiteCreate(BaseModel):
    name: str
    location: str | None = None
    organization_id: int | None = None  # URL'den alınır, body'de zorunlu değil


class SiteOut(BaseModel):
    id: int
    name: str
    location: str | None
    organization_id: int

    model_config = {"from_attributes": True}
