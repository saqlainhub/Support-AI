
from fastapi import Cookie, Depends, HTTPException, status
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_session_token
from app.database import get_db
from app.models import AdminUser, AuthSession, Customer


SESSION_COOKIE_NAME = "supportai_session"


async def get_current_customer(
    token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    """Require a valid session belonging to an active customer."""

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    result = await db.execute(
        select(AuthSession).where(
            AuthSession.token_hash == hash_session_token(token),
            AuthSession.customer_id.is_not(None),
            AuthSession.admin_id.is_(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session.",
        )

    result = await db.execute(
        select(Customer).where(
            Customer.id == session.customer_id,
            Customer.is_active.is_(True),
        )
    )
    customer = result.scalar_one_or_none()

    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Customer account is unavailable.",
        )

    return customer


async def get_current_admin(
    token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    """Require a valid session belonging to an active admin."""

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required.",
        )

    result = await db.execute(
        select(AuthSession).where(
            AuthSession.token_hash == hash_session_token(token),
            AuthSession.admin_id.is_not(None),
            AuthSession.customer_id.is_(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session.",
        )

    result = await db.execute(
        select(AdminUser).where(
            AdminUser.id == session.admin_id,
            AdminUser.is_active.is_(True),
        )
    )
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin account is unavailable.",
        )

    return admin
