from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from . import user, post, comment, like, message
from app.models.friendship import Friendship
from app.schemas.friendship import (  # ← Добавь
    FriendshipRequest,
    FriendshipResponse,
    UserBrief
)