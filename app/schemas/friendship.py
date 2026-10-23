from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class FriendshipRequest(BaseModel):
    addressee_id: int  # Кому отправляем запрос


class FriendshipResponse(BaseModel):
    id: int
    requester_id: int
    addressee_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserBrief(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True