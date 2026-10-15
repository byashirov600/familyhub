from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class Like(Base):
    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Связи
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 1 пользователь = 1 лайк
    __table_args__ = (
        UniqueConstraint('post_id', 'user_id', name='unique_post_user_like'),
    )

    def __repr__(self):
        return f"<Like by user {self.user_id} on post {self.post_id}>"