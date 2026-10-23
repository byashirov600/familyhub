from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    avatar_path: Optional[str] = None
    cover_path: Optional[str] = None
    bio: Optional[str] = None
    full_name: Optional[str] = None
    birth_year: Optional[int] = None
    workplace: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    bio: Optional[str] = None
    full_name: Optional[str] = None
    birth_year: Optional[int] = None
    workplace: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None