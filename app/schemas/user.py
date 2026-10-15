from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# Схема для создания пользователя (то, что присылает клиент)
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


# Схема ответа (то, что возвращаем клиенту)
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True  # Позволяет конвертировать ORM-объект в Pydantic

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None