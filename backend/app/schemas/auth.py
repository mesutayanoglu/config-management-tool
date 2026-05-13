from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str
    password: str
    email: str | None = None
    is_admin: bool = False


class UserOut(BaseModel):
    id: int
    username: str
    email: str | None
    is_admin: bool
    is_active: bool

    model_config = {"from_attributes": True}
