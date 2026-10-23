from sqlalchemy import Column, Integer, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.sql import func
from app.database import Base


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Кто отправил запрос
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Кому отправили запрос
    addressee_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Статус: pending (ожидает), accepted (принят), rejected (отклонён)
    status = Column(String, default="pending", nullable=False)

    # Уникальное ограничение: одна связь между двумя пользователями
    __table_args__ = (
        UniqueConstraint('requester_id', 'addressee_id', name='unique_friendship'),
    )

    def __repr__(self):
        return f"<Friendship {self.requester_id} -> {self.addressee_id} [{self.status}]>"