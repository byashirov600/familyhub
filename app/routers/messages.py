from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, update, text
from app.database import get_db
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreate
from app.routers.users import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/send", status_code=201)
async def send_message(
        data: MessageCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Отправить сообщение пользователю"""

    result = await db.execute(select(User).where(User.id == data.receiver_id))
    receiver = result.scalar_one_or_none()

    if not receiver:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if receiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя отправить сообщение себе")

    # Используем insert вместо ORM
    stmt = Message.__table__.insert().values(
        sender_id=current_user.id,
        receiver_id=data.receiver_id,
        text=data.text
    )
    result = await db.execute(stmt)
    await db.commit()

    # Получаем созданное сообщение
    msg_id = result.inserted_primary_key[0]
    result = await db.execute(
        select(
            Message.id,
            Message.sender_id,
            Message.receiver_id,
            Message.text,
            Message.is_read,
            Message.created_at
        ).where(Message.id == msg_id)
    )
    msg = result.first()

    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "text": msg.text,
        "is_read": bool(msg.is_read) if msg.is_read is not None else False,
        "created_at": msg.created_at.isoformat() if msg.created_at else None
    }


@router.get("/chats")
async def get_chats(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить список чатов"""

    # Явно выбираем колонки
    result = await db.execute(
        select(
            Message.sender_id,
            Message.receiver_id,
            Message.text,
            Message.created_at,
            Message.is_read
        ).where(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id
            )
        ).order_by(Message.created_at.desc())
    )
    rows = result.fetchall()

    chats = {}
    for row in rows:
        other_user_id = row.receiver_id if row.sender_id == current_user.id else row.sender_id

        if other_user_id not in chats:
            chats[other_user_id] = {
                'last_message': row.text,
                'last_message_time': row.created_at,
                'unread_count': 0
            }

        if row.receiver_id == current_user.id and not row.is_read:
            chats[other_user_id]['unread_count'] += 1

    chat_users = []
    for user_id, info in chats.items():
        user_result = await db.execute(select(User.id, User.username).where(User.id == user_id))
        user = user_result.first()

        if user:
            last_time_str = None
            if info['last_message_time']:
                if hasattr(info['last_message_time'], 'isoformat'):
                    last_time_str = info['last_message_time'].isoformat()
                else:
                    last_time_str = str(info['last_message_time'])

            chat_users.append({
                "id": user.id,
                "username": user.username,
                "last_message": info['last_message'],
                "last_message_time": last_time_str,
                "unread_count": info['unread_count']
            })

    from datetime import datetime as dt
    chat_users.sort(key=lambda x: x['last_message_time'] or '', reverse=True)

    return chat_users


@router.get("/chat/{user_id}")
async def get_chat_history(
        user_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить историю переписки с пользователем"""

    # Проверяем существование пользователя
    result = await db.execute(select(User.id, User.username).where(User.id == user_id))
    other_user = result.first()

    if not other_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Помечаем все непрочитанные сообщения как прочитанные
    await db.execute(
        update(Message)
        .where(
            and_(
                Message.receiver_id == current_user.id,
                Message.sender_id == user_id,
                Message.is_read == False
            )
        )
        .values(is_read=True)
    )
    await db.commit()

    # Явно выбираем колонки
    result = await db.execute(
        select(
            Message.id,
            Message.sender_id,
            Message.receiver_id,
            Message.text,
            Message.is_read,
            Message.created_at
        ).where(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
                and_(Message.sender_id == user_id, Message.receiver_id == current_user.id)
            )
        ).order_by(Message.created_at.asc())
    )

    rows = result.fetchall()

    result_list = []
    for row in rows:
        created_at_str = None
        if row.created_at:
            if hasattr(row.created_at, 'isoformat'):
                created_at_str = row.created_at.isoformat()
            else:
                created_at_str = str(row.created_at)

        result_list.append({
            "id": row.id,
            "sender_id": row.sender_id,
            "receiver_id": row.receiver_id,
            "text": row.text,
            "is_read": bool(row.is_read) if row.is_read is not None else False,
            "created_at": created_at_str
        })

    return result_list


@router.get("/users")
async def get_all_users(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить список всех пользователей"""

    result = await db.execute(select(User.id, User.username).where(User.id != current_user.id))
    users = result.fetchall()

    return [{"id": u.id, "username": u.username} for u in users]