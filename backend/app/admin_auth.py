
import os
import secrets
from datetime import datetime, timedelta, timezone



from fastapi import APIRouter, Depends, HTTPException, Response, status, Cookie
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.database import get_db
from app.dependencies import get_current_admin
from app.models import AdminUser, AuthSession


router = APIRouter(prefix="/admin/auth", tags=["Admin Authentication"])

SESSION_COOKIE_NAME = "supportai_session"
SESSION_DURATION_DAYS = 7
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


class AdminCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=12, max_length=128)


class AdminUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=100)
    password: str | None = Field(default=None, min_length=12, max_length=128)
    is_active: bool | None = None


class AdminResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


def set_admin_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
        path="/",
    )


def clear_admin_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


async def create_admin_session(
    db: AsyncSession,
    admin_id: int,
) -> str:
    token = create_session_token()

    session = AuthSession(
        token_hash=hash_session_token(token),
        admin_id=admin_id,
        customer_id=None,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=SESSION_DURATION_DAYS),
    )

    db.add(session)
    await db.flush()
    return token


@router.post("/login")
async def admin_login(
    data: AdminLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).where(
            func.lower(AdminUser.username) == data.username.strip().lower()
        )
    )
    admin = result.scalar_one_or_none()

    if (
        admin is None
        or not admin.is_active
        or not verify_password(data.password, admin.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    token = await create_admin_session(db, admin.id)
    await db.commit()
    set_admin_cookie(response, token)

    return {
        "id": admin.id,
        "username": admin.username,
        "role": "admin",
    }


@router.get("/me", response_model=AdminResponse)
async def get_admin_profile(
    admin: AdminUser = Depends(get_current_admin),
):
    return admin



@router.post("/logout")
async def admin_logout(
    response: Response,
    token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if token:
        token_hash = hash_session_token(token)

        result = await db.execute(
            select(AuthSession).where(
                AuthSession.token_hash == token_hash,
                AuthSession.admin_id == admin.id,
            )
        )
        session = result.scalar_one_or_none()

        if session is not None:
            await db.delete(session)
            await db.commit()

    clear_admin_cookie(response)
    return {"message": "Logged out successfully."}


@router.get("/admins", response_model=list[AdminResponse])
async def list_admins(
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).order_by(AdminUser.id)
    )
    return result.scalars().all()


@router.post(
    "/admins",
    response_model=AdminResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_admin(
    data: AdminCreateRequest,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    username = data.username.strip()

    if not username:
        raise HTTPException(400, "Username cannot be empty.")

    existing = await db.execute(
        select(AdminUser).where(
            func.lower(AdminUser.username) == username.lower()
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Username already exists.")

    admin = AdminUser(
        username=username,
        password_hash=hash_password(data.password),
        is_active=True,
    )
    db.add(admin)

    try:
        await db.commit()
        await db.refresh(admin)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Username already exists.")

    return admin


@router.patch("/admins/{admin_id}", response_model=AdminResponse)
async def update_admin(
    admin_id: int,
    data: AdminUpdateRequest,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).where(AdminUser.id == admin_id)
    )
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(404, "Admin not found.")

    changes = data.model_dump(exclude_unset=True)

    if "username" in changes:
        username = changes["username"]
        if username is None or not username.strip():
            raise HTTPException(400, "Username cannot be empty.")

        username = username.strip()
        existing = await db.execute(
            select(AdminUser).where(
                func.lower(AdminUser.username) == username.lower(),
                AdminUser.id != admin_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(409, "Username already exists.")

        admin.username = username

    if "password" in changes:
        password = changes["password"]
        if password is None:
            raise HTTPException(400, "Password cannot be empty.")
        admin.password_hash = hash_password(password)

    if "is_active" in changes:
        new_active = changes["is_active"]

        if new_active is False and admin.is_active:
            active_count_result = await db.execute(
                select(func.count())
                .select_from(AdminUser)
                .where(AdminUser.is_active.is_(True))
            )
            active_count = active_count_result.scalar_one()

            if active_count <= 1:
                raise HTTPException(
                    400,
                    "Cannot deactivate the last active admin.",
                )

            if admin.id == current_admin.id:
                raise HTTPException(
                    400,
                    "You cannot deactivate your own account.",
                )

        admin.is_active = new_active

    try:
        await db.commit()
        await db.refresh(admin)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Could not update admin.")

    return admin


@router.delete("/admins/{admin_id}")
async def delete_admin(
    admin_id: int,
    current_admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).where(AdminUser.id == admin_id)
    )
    admin = result.scalar_one_or_none()

    if admin is None:
        raise HTTPException(404, "Admin not found.")

    if admin.id == current_admin.id:
        raise HTTPException(400, "You cannot delete your own account.")

    if admin.is_active:
        active_count_result = await db.execute(
            select(func.count())
            .select_from(AdminUser)
            .where(AdminUser.is_active.is_(True))
        )
        if active_count_result.scalar_one() <= 1:
            raise HTTPException(
                400,
                "Cannot delete the last active admin.",
            )

    # Revoke the deleted admin's sessions before deleting the account.
    sessions = await db.execute(
        select(AuthSession).where(AuthSession.admin_id == admin.id)
    )
    for session in sessions.scalars().all():
        await db.delete(session)

    await db.delete(admin)
    await db.commit()

    return {"message": "Admin deleted successfully."}
