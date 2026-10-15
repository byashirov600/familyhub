from pydantic import BaseModel
from datetime import datetime


class LikeResponse(BaseModel):
    id: int
    created_at: datetime
    post_id: int
    user_id: int

    class Config:
        from_attributes = True