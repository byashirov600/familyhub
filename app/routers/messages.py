from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, update, text
import os
import shutil
from pathlib import Path
from app.database import get_db
from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreate, MessageUpdate
from app.routers.users import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])

# Папка для вложений
ATTACHMENTS_DIR = Path("uploads/messages")
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/send", status_code=201)
async def send_message(
        receiver_id: int,
        text: str = Form(""),
        attachment: UploadFile = File(None),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Отправить сообщение пользователю"""

    # Если нет ни текста, ни файла — ошибка
    if not text and not attachment:
        raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")

    result = await db.execute(select(User).where(User.id == receiver_id))
    receiver = result.scalar_one_or_none()

    if not receiver:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if receiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя отправить сообщение себе")

    attachment_path = None
    if attachment:
        file_extension = os.path.splitext(attachment.filename)[1]
        filename = f"msg_{current_user.id}_{receiver_id}_{int(__import__('time').time())}{file_extension}"
        attachment_path = str(ATTACHMENTS_DIR / filename)

        with open(attachment_path, "wb") as buffer:
            shutil.copyfileobj(attachment.file, buffer)

    # Если текст пустой, но есть файл — используем имя файла
    if not text and attachment:
        text = f"📎 {attachment.filename}"

    stmt = Message.__table__.insert().values(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        text=text,
        attachment_path=attachment_path
    )
    result = await db.execute(stmt)
    await db.commit()

    msg_id = result.inserted_primary_key[0]
    result = await db.execute(
        select(
            Message.id,
            Message.sender_id,
            Message.receiver_id,
            Message.text,
            Message.attachment_path,
            Message.is_read,
            Message.created_at,
            Message.updated_at
        ).where(Message.id == msg_id)
    )
    msg = result.first()

    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "text": msg.text,
        "attachment_path": msg.attachment_path,
        "is_read": bool(msg.is_read) if msg.is_read is not None else False,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "updated_at": msg.updated_at.isoformat() if msg.updated_at else None
    }


@router.put("/{message_id}")
async def update_message(
        message_id: int,
        data: MessageUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Редактировать сообщение"""

    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Можно редактировать только свои сообщения")

    await db.execute(
        update(Message)
        .where(Message.id == message_id)
        .values(text=data.text)
    )
    await db.commit()

    return {"message": "Сообщение обновлено"}


@router.delete("/{message_id}")
async def delete_message(
        message_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить сообщение"""

    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")

    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Можно удалять только свои сообщения")

    # Удаляем файл вложения если есть
    if message.attachment_path and os.path.exists(message.attachment_path):
        os.remove(message.attachment_path)

    await db.execute(
        Message.__table__.delete().where(Message.id == message_id)
    )
    await db.commit()

    return {"message": "Сообщение удалено"}


@router.get("/chats")
async def get_chats(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить список чатов"""

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

    result = await db.execute(select(User.id, User.username).where(User.id == user_id))
    other_user = result.first()

    if not other_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

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

    result = await db.execute(
        select(
            Message.id,
            Message.sender_id,
            Message.receiver_id,
            Message.text,
            Message.attachment_path,
            Message.is_read,
            Message.created_at,
            Message.updated_at
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

        updated_at_str = None
        if row.updated_at:
            if hasattr(row.updated_at, 'isoformat'):
                updated_at_str = row.updated_at.isoformat()
            else:
                updated_at_str = str(row.updated_at)

        result_list.append({
            "id": row.id,
            "sender_id": row.sender_id,
            "receiver_id": row.receiver_id,
            "text": row.text,
            "attachment_path": row.attachment_path,
            "is_read": bool(row.is_read) if row.is_read is not None else False,
            "created_at": created_at_str,
            "updated_at": updated_at_str
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