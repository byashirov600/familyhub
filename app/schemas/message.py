from pydantic import BaseModel
from typing import Optional


class MessageCreate(BaseModel):
    receiver_id: int
    text: str
    attachment_path: Optional[str] = None


class MessageUpdate(BaseModel):
    text: str


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    text: str
    attachment_path: Optional[str] = None
    is_read: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class ChatUser(BaseModel):
    id: int
    username: str
    last_message: Optional[str] = None
    last_message_time: Optional[str] = None
    unread_count: int = 0

    class Config:
        from_attributes = True