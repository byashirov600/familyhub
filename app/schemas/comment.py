from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CommentCreate(BaseModel):
    text: str


class CommentResponse(BaseModel):
    id: int
    text: str
    created_at: datetime
    post_id: int
    author_id: int
    author_username: Optional[str] = None

    class Config:
        from_attributes = True