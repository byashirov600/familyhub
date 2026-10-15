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

    class Config:
        from_attributes = True