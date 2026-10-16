from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PostCreate(BaseModel):
    title: str
    content: str


class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    image_path: Optional[str] = None
    created_at: datetime
    author_id: int
    author_username: Optional[str] = None

    class Config:
        from_attributes = True