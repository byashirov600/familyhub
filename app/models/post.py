from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    image_path = Column(String, nullable=True)  # Путь к картинке
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Связь с пользователем (один ко многим)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author = relationship("User", backref="posts")

    def __repr__(self):
        return f"<Post {self.title} by user {self.author_id}>"