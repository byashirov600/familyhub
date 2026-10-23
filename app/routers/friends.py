from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.friendship import FriendshipRequest, FriendshipResponse, UserBrief
from app.routers.users import get_current_user

router = APIRouter(prefix="/friends", tags=["friends"])


@router.post("/request", response_model=FriendshipResponse, status_code=201)
async def send_friend_request(
        data: FriendshipRequest,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Отправить запрос в друзья"""

    # Нельзя отправить запрос самому себе
    if data.addressee_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")

    # Проверяем, существует ли пользователь
    result = await db.execute(select(User).where(User.id == data.addressee_id))
    addressee = result.scalar_one_or_none()
    if not addressee:
        raise HTTPException(status_code=404, detail="User not found")

    # Проверяем, нет ли уже запроса
    result = await db.execute(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == current_user.id) & (Friendship.addressee_id == data.addressee_id),
                (Friendship.requester_id == data.addressee_id) & (Friendship.addressee_id == current_user.id)
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="You are already friends")
        elif existing.status == "pending":
            raise HTTPException(status_code=400, detail="Friend request already sent")
        else:
            # Если был отклонён — создаём новый
            existing.status = "pending"
            existing.requester_id = current_user.id
            existing.addressee_id = data.addressee_id
            await db.commit()
            await db.refresh(existing)
            return existing

    # Создаём новый запрос
    friendship = Friendship(
        requester_id=current_user.id,
        addressee_id=data.addressee_id,
        status="pending"
    )

    db.add(friendship)
    await db.commit()
    await db.refresh(friendship)

    return friendship


@router.post("/request/{friendship_id}/accept", response_model=FriendshipResponse)
async def accept_friend_request(
        friendship_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Принять запрос в друзья"""

    result = await db.execute(
        select(Friendship).where(
            (Friendship.id == friendship_id) &
            (Friendship.addressee_id == current_user.id) &
            (Friendship.status == "pending")
        )
    )
    friendship = result.scalar_one_or_none()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")

    friendship.status = "accepted"
    await db.commit()
    await db.refresh(friendship)

    return friendship


@router.post("/request/{friendship_id}/reject", response_model=FriendshipResponse)
async def reject_friend_request(
        friendship_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Отклонить запрос в друзья"""

    result = await db.execute(
        select(Friendship).where(
            (Friendship.id == friendship_id) &
            (Friendship.addressee_id == current_user.id) &
            (Friendship.status == "pending")
        )
    )
    friendship = result.scalar_one_or_none()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")

    friendship.status = "rejected"
    await db.commit()
    await db.refresh(friendship)

    return friendship


@router.delete("/{friend_id}", status_code=204)
async def remove_friend(
        friend_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Удалить из друзей"""

    result = await db.execute(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == current_user.id) & (Friendship.addressee_id == friend_id),
                (Friendship.requester_id == friend_id) & (Friendship.addressee_id == current_user.id)
            ) & (Friendship.status == "accepted")
        )
    )
    friendship = result.scalar_one_or_none()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")

    await db.delete(friendship)
    await db.commit()

    return None


@router.get("/my", response_model=list[UserBrief])
async def get_my_friends(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить список моих друзей"""

    result = await db.execute(
        select(Friendship).where(
            or_(
                (Friendship.requester_id == current_user.id),
                (Friendship.addressee_id == current_user.id)
            ) & (Friendship.status == "accepted")
        )
    )
    friendships = result.scalars().all()

    friend_ids = []
    for f in friendships:
        if f.requester_id == current_user.id:
            friend_ids.append(f.addressee_id)
        else:
            friend_ids.append(f.requester_id)

    if not friend_ids:
        return []

    result = await db.execute(select(User).where(User.id.in_(friend_ids)))
    friends = result.scalars().all()

    return friends


@router.get("/requests/incoming", response_model=list[FriendshipResponse])
async def get_incoming_requests(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить входящие запросы в друзья"""

    result = await db.execute(
        select(Friendship).where(
            (Friendship.addressee_id == current_user.id) &
            (Friendship.status == "pending")
        )
    )
    return result.scalars().all()


@router.get("/requests/outgoing", response_model=list[FriendshipResponse])
async def get_outgoing_requests(
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получить исходящие запросы в друзья"""

    result = await db.execute(
        select(Friendship).where(
            (Friendship.requester_id == current_user.id) &
            (Friendship.status == "pending")
        )
    )
    return result.scalars().all()