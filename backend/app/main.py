
import hashlib
import os
import tempfile
import io
import uuid
from pathlib import Path
from typing import Literal
from app.admin_auth import router as admin_auth_router
from app.dependencies import get_current_admin, get_current_customer, SESSION_COOKIE_NAME
from PIL import Image, UnidentifiedImageError
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

import secrets

from authlib.integrations.starlette_client import OAuth
from fastapi.responses import RedirectResponse
from starlette.config import Config

from fastapi import Depends, FastAPI, File, Request, HTTPException, Query, UploadFile, Cookie, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.activity_service import log_activity
from app.database import SessionLocal, get_db
from app.document_loader import extract_pages_from_pdf
from app.ingestion_service import ingest_document
from app.models import (
    AIUsageLog,
    Conversation,
    Customer,
    Document,
    Message,
    SupportTicket,
    SystemActivity,
    AdminUser,
    AuthSession,
    OAuthAccount,
)
from app.rag_service import generate_rag_response
from app.schemas import ChatRequest, ChatResponse, AdminLoginRequest
from app.ticket_service import create_ticket

from datetime import datetime, timedelta, timezone

from fastapi import Cookie, Response
from sqlalchemy.exc import IntegrityError

from app.auth import (
    create_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.schemas import (
    AuthStatusResponse,
    ChatRequest,
    ChatResponse,
    CustomerAuthResponse,
    CustomerLoginRequest,
    CustomerSignupRequest,
    CustomerProfileUpdate,
    MessageResponse,
)


MAX_FILE_SIZE = 25 * 1024 * 1024
MAX_DOCUMENTS = 100

SESSION_COOKIE_NAME = "supportai_session"
SESSION_DURATION_DAYS = 7

# Set COOKIE_SECURE=true in production when using HTTPS.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

app = FastAPI()


oauth = OAuth()

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={
        "scope": "openid email profile",
    },
)

UPLOAD_ROOT = Path("uploads").resolve()
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_ROOT)),
    name="uploads",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET_KEY"],
    same_site="lax",
    https_only=COOKIE_SECURE,
)


app.include_router(admin_auth_router)

class TicketRequest(BaseModel):
    customer_id: int
    conversation_id: int
    subject: str = Field(min_length=1, max_length=255)
    description: str


class TicketStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "closed"]


class ConversationTitleUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=120)



PROFILE_UPLOAD_DIR = Path("uploads/profile_photos").resolve()
PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024  # 2 MB

ALLOWED_IMAGE_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


@app.get("/")
def root():
    return {"message": "AI Customer Support API is running"}




# --------------------------------------------------
# CUSTOMER AUTHENTICATION
# --------------------------------------------------


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_DURATION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


async def create_customer_session(
    db: AsyncSession,
    customer_id: int,
) -> str:
    token = create_session_token()

    session = AuthSession(
        token_hash=hash_session_token(token),
        customer_id=customer_id,
        admin_id=None,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=SESSION_DURATION_DAYS),
    )

    db.add(session)
    await db.flush()

    return token


async def get_authenticated_customer(
    token: str | None,
    db: AsyncSession,
) -> Customer | None:
    if not token:
        return None

    token_hash = hash_session_token(token)

    result = await db.execute(
        select(AuthSession).where(
            AuthSession.token_hash == token_hash,
            AuthSession.customer_id.is_not(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
    )

    session = result.scalar_one_or_none()

    if session is None:
        return None

    result = await db.execute(
        select(Customer).where(
            Customer.id == session.customer_id,
            Customer.is_active.is_(True),
        )
    )

    return result.scalar_one_or_none()


@app.post(
    "/auth/signup",
    response_model=CustomerAuthResponse,
    status_code=201,
)
async def customer_signup(
    request: CustomerSignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    email = str(request.email).strip().lower()

    result = await db.execute(
        select(Customer).where(func.lower(Customer.email) == email)
    )

    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    customer = Customer(
        name=request.name,
        email=email,
        password_hash=hash_password(request.password),
        is_active=True,
        email_verified=False,
    )

    try:
        db.add(customer)
        await db.flush()

        token = await create_customer_session(db, customer.id)

        await log_activity(
            db=db,
            event_type="customer_registered",
            description=f"Customer #{customer.id} registered.",
            entity_type="customer",
            entity_id=customer.id,
        )

        await db.commit()
        await db.refresh(customer)

    except IntegrityError:
        await db.rollback()

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    except Exception:
        await db.rollback()
        raise

    set_session_cookie(response, token)

    return CustomerAuthResponse(
        id=customer.id,
        name=customer.name,
        email=customer.email,
        photo_url=customer.photo_url,
        email_verified=customer.email_verified,
        role="customer",
    )


@app.post("/auth/login", response_model=CustomerAuthResponse)
async def customer_login(
    request: CustomerLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    email = str(request.email).strip().lower()

    result = await db.execute(
        select(Customer).where(func.lower(Customer.email) == email)
    )
    customer = result.scalar_one_or_none()

    # Use the same error for an unknown email and an incorrect password.
    if (
        customer is None
        or not customer.password_hash
        or not verify_password(request.password, customer.password_hash)
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is disabled.",
        )

    try:
        token = await create_customer_session(db, customer.id)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    set_session_cookie(response, token)

    return CustomerAuthResponse(
        id=customer.id,
        name=customer.name,
        email=customer.email,
        photo_url=customer.photo_url,
        email_verified=customer.email_verified,
        role="customer",
    )


@app.get("/auth/me", response_model=AuthStatusResponse)
async def customer_auth_status(
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    customer = await get_authenticated_customer(token, db)

    if customer is None:
        return AuthStatusResponse(
            authenticated=False,
            customer=None,
        )

    return AuthStatusResponse(
        authenticated=True,
        customer=CustomerAuthResponse(
            id=customer.id,
            name=customer.name,
            email=customer.email,
            photo_url=customer.photo_url,
            email_verified=customer.email_verified,
            role="customer",
        ),
    )


@app.post("/auth/logout", response_model=MessageResponse)
async def customer_logout(
    response: Response,
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
    db: AsyncSession = Depends(get_db),
):
    if token:
        result = await db.execute(
            select(AuthSession).where(
                AuthSession.token_hash == hash_session_token(token),
                AuthSession.customer_id.is_not(None),
            )
        )

        session = result.scalar_one_or_none()

        if session is not None:
            await db.delete(session)
            await db.commit()

    clear_session_cookie(response)

    return MessageResponse(message="Logged out successfully.")

@app.get("/auth/google/login")
async def google_login(request: Request):
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not redirect_uri:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth redirect URI is not configured.",
        )

    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
    )


@app.get("/auth/google/callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:3000",
    ).rstrip("/")

    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")

        if not user_info:
            user_info = await oauth.google.userinfo(token=token)

        google_user_id = user_info.get("sub")
        email = user_info.get("email")
        email_verified = user_info.get("email_verified", False)

        if (
            not google_user_id
            or not email
            or email_verified is not True
        ):
            return RedirectResponse(
                f"{frontend_url}/login?error=google_identity_not_verified",
                status_code=303,
            )

        # Find an existing account linked to this exact Google identity.
        result = await db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == "google",
                OAuthAccount.provider_user_id == google_user_id,
            )
        )
        oauth_account = result.scalar_one_or_none()

        if oauth_account:
            customer_result = await db.execute(
                select(Customer).where(
                    Customer.id == oauth_account.customer_id
                )
            )
            customer = customer_result.scalar_one_or_none()

            if customer is None or not customer.is_active:
                return RedirectResponse(
                    f"{frontend_url}/login?error=account_unavailable",
                    status_code=303,
                )

        else:
            # Never automatically link Google to an existing account by email.
            customer_result = await db.execute(
                select(Customer).where(Customer.email == email)
            )
            existing_customer = customer_result.scalar_one_or_none()

            if existing_customer:
                return RedirectResponse(
                    f"{frontend_url}/login?error=account_exists_use_existing_login",
                    status_code=303,
                )

            customer = Customer(
                name=user_info.get("name"),
                email=email,
                password_hash=None,
                photo_url=user_info.get("picture"),
                is_active=True,
                email_verified=True,
            )
            db.add(customer)
            await db.flush()

            oauth_account = OAuthAccount(
                customer_id=customer.id,
                provider="google",
                provider_user_id=google_user_id,
            )
            db.add(oauth_account)

        # Create the same server-side session used by password login.
        session_token = await create_customer_session(
            db,
            customer.id,
        )

        await db.commit()

        response = RedirectResponse(
            f"{frontend_url}/?oauth=google_success",
            status_code=303,
        )
        set_session_cookie(response, session_token)

        return response

    except Exception:
        await db.rollback()

        # Keep internal exceptions and provider tokens out of the URL.
        return RedirectResponse(
            f"{frontend_url}/login?error=google_login_failed",
            status_code=303,
        )



@app.get("/auth/google/link")
async def google_link(
    request: Request,
    customer: Customer = Depends(get_current_customer),
):
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")

    if not redirect_uri:
        raise HTTPException(
            status_code=500,
            detail="Google OAuth redirect URI is not configured.",
        )

    request.session["google_link_customer_id"] = customer.id

    link_redirect_uri = (
        redirect_uri.rsplit("/", 1)[0] + "/link/callback"
    )

    return await oauth.google.authorize_redirect(
        request,
        link_redirect_uri,
    )


@app.get("/auth/google/link/callback")
async def google_link_callback(
    request: Request,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:3000",
    ).rstrip("/")

    customer_id = request.session.pop(
        "google_link_customer_id",
        None,
    )

    if not customer_id or str(customer.id) != str(customer_id):
        return RedirectResponse(
            f"{frontend_url}/login?error=google_link_session_expired",
            status_code=303,
        )


    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")

        if not user_info:
            user_info = await oauth.google.userinfo(token=token)

        google_user_id = user_info.get("sub")
        email_verified = user_info.get("email_verified", False)

        if not google_user_id or email_verified is not True:
            return RedirectResponse(
                f"{frontend_url}/?error=google_identity_not_verified",
                status_code=303,
            )

        customer_result = await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.is_active.is_(True),
            )
        )
        customer = customer_result.scalar_one_or_none()

        if customer is None:
            return RedirectResponse(
                f"{frontend_url}/login?error=account_unavailable",
                status_code=303,
            )

        existing_link_result = await db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == "google",
                OAuthAccount.provider_user_id == google_user_id,
            )
        )
        existing_link = existing_link_result.scalar_one_or_none()

        if existing_link:
            if existing_link.customer_id == customer.id:
                return RedirectResponse(
                    f"{frontend_url}/?oauth=google_already_linked",
                    status_code=303,
                )

            return RedirectResponse(
                f"{frontend_url}/?error=google_account_linked_elsewhere",
                status_code=303,
            )

        db.add(
            OAuthAccount(
                customer_id=customer.id,
                provider="google",
                provider_user_id=google_user_id,
            )
        )
        await db.commit()

        return RedirectResponse(
            f"{frontend_url}/?oauth=google_linked",
            status_code=303,
        )

    except Exception as exc:
        await db.rollback()
        print(
            f"Google account linking failed: "
            f"{type(exc).__name__}: {exc}"
        )

        return RedirectResponse(
            f"{frontend_url}/?error=google_link_failed",
            status_code=303,
        )

 


# --------------------------------------------------
# ADMIN AUTHENTICATION
# --------------------------------------------------


@app.post("/admin/auth/login")
async def admin_login(
    request: AdminLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    username = request.username.strip()

    result = await db.execute(
        select(AdminUser).where(AdminUser.username == username)
    )
    admin = result.scalar_one_or_none()

    # Use the same error for an unknown username and wrong password.
    if admin is None or not verify_password(
        request.password,
        admin.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This admin account is disabled.",
        )

    token = create_session_token()

    session = AuthSession(
        token_hash=hash_session_token(token),
        customer_id=None,
        admin_id=admin.id,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=SESSION_DURATION_DAYS),
    )

    try:
        db.add(session)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    set_session_cookie(response, token)

    return {
        "id": admin.id,
        "username": admin.username,
        "role": "admin",
    }


@app.get("/admin/auth/me")
async def admin_auth_status(
    admin: AdminUser = Depends(get_current_admin),
):
    return {
        "authenticated": True,
        "admin": {
            "id": admin.id,
            "username": admin.username,
            "role": "admin",
        },
    }


@app.post("/admin/auth/logout", response_model=MessageResponse)
async def admin_logout(
    response: Response,
    token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    db: AsyncSession = Depends(get_db),
):
    if token:
        result = await db.execute(
            select(AuthSession).where(
                AuthSession.token_hash == hash_session_token(token),
                AuthSession.admin_id.is_not(None),
                AuthSession.customer_id.is_(None),
            )
        )

        session = result.scalar_one_or_none()

        if session is not None:
            await db.delete(session)
            await db.commit()

    clear_session_cookie(response)

    return MessageResponse(message="Admin logged out successfully.")


# --------------------------------------------------
# CHAT
# --------------------------------------------------



@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    token: str | None = Cookie(
        default=None,
        alias=SESSION_COOKIE_NAME,
    ),
    db: AsyncSession = Depends(get_db),
):
    # 1. Resolve the customer from the session cookie or visitor ID.
    customer = None

    if token:
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
                status_code=401,
                detail="Invalid or expired session. Please sign in again.",
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
                status_code=401,
                detail="Customer account is unavailable.",
            )

    else:
        # Preserve anonymous chat for visitors without a session cookie.
        if not request.visitor_id:
            raise HTTPException(
                status_code=401,
                detail=(
                    "Authentication required. "
                    "Please sign in or provide a visitor ID."
                ),
            )

        result = await db.execute(
            select(Customer).where(
                Customer.visitor_id == request.visitor_id
            )
        )
        customer = result.scalar_one_or_none()

        if customer is None:
            customer = Customer(
                name="Anonymous Customer",
                visitor_id=request.visitor_id,
            )
            db.add(customer)
            await db.flush()

            await log_activity(
                db=db,
                event_type="customer_created",
                description=f"Customer #{customer.id} was created.",
                entity_type="customer",
                entity_id=customer.id,
            )

    # 2. Find the requested conversation belonging to this customer.
    conversation = None

    if request.conversation_id is not None:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == request.conversation_id,
                Conversation.customer_id == customer.id,
            )
        )
        conversation = result.scalar_one_or_none()

    # 3. Create a new conversation if the requested one does not
    # belong to this customer or no conversation ID was supplied.
    conversation_created = False

    if conversation is None:
        conversation = Conversation(
            customer_id=customer.id,
        )
        db.add(conversation)
        await db.flush()
        conversation_created = True

    if conversation_created:
        await log_activity(
            db=db,
            event_type="conversation_created",
            description=f"Conversation #{conversation.id} was created.",
            entity_type="conversation",
            entity_id=conversation.id,
        )

    # 4. Save the customer's message.
    user_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=request.message,
    )
    db.add(user_message)

    # Generate a title from the first message only.
    # Preserve existing titles, including manually renamed titles.
    if not conversation.title:
        normalized_message = " ".join(request.message.split())
        conversation.title = (
            normalized_message[:120] or "New conversation"
        )

    # 5. Generate the response using the existing RAG pipeline.
    response, interaction_id = await generate_rag_response(
        db=db,
        question=request.message,
        previous_interaction_id=conversation.gemini_interaction_id,
        customer_id=customer.id,
        conversation_id=conversation.id,
    )

    # 6. Save the Gemini interaction ID and assistant response.
    conversation.gemini_interaction_id = interaction_id

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=response.answer,
    )
    db.add(assistant_message)

    # 7. Log successful response generation.
    await log_activity(
        db=db,
        event_type="ai_response_generated",
        description=(
            f"AI generated a response for conversation "
            f"#{conversation.id}."
        ),
        entity_type="conversation",
        entity_id=conversation.id,
    )

    # 8. Commit all database changes.
    await db.commit()

    # 9. Return the existing response format.
    return ChatResponse(
        response=response.answer,
        sources=response.sources,
        conversation_id=conversation.id,
    )


# --------------------------------------------------
# CUSTOMER CONVERSATIONS
# --------------------------------------------------



@app.get("/customer/conversations")
async def get_conversations(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.customer_id == customer.id)
        .order_by(Conversation.created_at.desc())
    )

    conversations = result.scalars().all()

    return [
        {
            "id": conversation.id,
            "customer_id": conversation.customer_id,
            "title": conversation.title,
            "created_at": conversation.created_at,
        }
        for conversation in conversations
    ]




@app.get(
    "/conversations",
    dependencies=[Depends(get_current_admin)],
)
async def get_all_conversations(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).order_by(Conversation.created_at.desc())
    )
    conversations = result.scalars().all()

    return [
        {
            "id": conversation.id,
            "customer_id": conversation.customer_id,
            "title": conversation.title,
            "created_at": conversation.created_at,
        }
        for conversation in conversations
    ]



@app.get(
        "/conversations/{conversation_id}",
         dependencies=[Depends(get_current_admin)],
         )
async def get_admin_conversation(
    conversation_id: int,
    db: AsyncSession = Depends(get_db),
):
    # Find the conversation.
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    # Load messages in chronological order.
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at, Message.id)
    )
    messages = result.scalars().all()

    return {
        "conversation_id": conversation.id,
        "title": conversation.title,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }




@app.get("/customer/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.customer_id == customer.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at, Message.id)
    )
    messages = result.scalars().all()

    return {
        "conversation_id": conversation.id,
        "title": conversation.title,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at,
            }
            for message in messages
        ],
    }




@app.patch("/customer/conversations/{conversation_id}")
async def rename_customer_conversation(
    conversation_id: int,
    request: ConversationTitleUpdate,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    title = " ".join(request.title.split())

    if not title:
        raise HTTPException(
            status_code=422,
            detail="Title cannot be empty or contain only spaces",
        )

    if len(title) > 120:
        raise HTTPException(
            status_code=422,
            detail="Title must not exceed 120 characters",
        )

    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.customer_id == customer.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    old_title = conversation.title
    conversation.title = title

    if old_title != title:
        await log_activity(
            db=db,
            event_type="conversation_renamed",
            description=f"Conversation #{conversation.id} was renamed.",
            entity_type="conversation",
            entity_id=conversation.id,
        )

    await db.commit()
    await db.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title,
    }



@app.delete("/customer/conversations/{conversation_id}")
async def delete_customer_conversation(
    conversation_id: int,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.customer_id == customer.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found",
        )

    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conversation.id
        )
    )
    messages = result.scalars().all()

    for message in messages:
        await db.delete(message)

    await log_activity(
        db=db,
        event_type="conversation_deleted",
        description=f"Conversation #{conversation.id} was deleted.",
        entity_type="conversation",
        entity_id=conversation.id,
    )

    await db.delete(conversation)
    await db.commit()

    return {
        "message": "Conversation deleted successfully",
        "conversation_id": conversation_id,
    }





# --------------------------------------------------
# CUSTOMER PROFILE
# --------------------------------------------------

@app.get("/customer/profile", response_model=CustomerAuthResponse)
async def get_customer_profile(
    customer: Customer = Depends(get_current_customer),
):
    """Return the authenticated customer's profile."""

    return CustomerAuthResponse(
        id=customer.id,
        name=customer.name,
        email=customer.email,
        photo_url=customer.photo_url,
        email_verified=customer.email_verified,
        role="customer",
    )


@app.patch("/customer/profile", response_model=CustomerAuthResponse)
async def update_customer_profile(
    request: CustomerProfileUpdate,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated customer's editable profile fields."""

    customer.name = request.name

    await db.commit()
    await db.refresh(customer)

    return CustomerAuthResponse(
        id=customer.id,
        name=customer.name,
        email=customer.email,
        photo_url=customer.photo_url,
        email_verified=customer.email_verified,
        role="customer",
    )


@app.post("/customer/profile/photo", response_model=CustomerAuthResponse)
async def upload_customer_profile_photo(
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    """Upload and update the authenticated customer's profile photo."""

    image_bytes = await file.read(MAX_PROFILE_IMAGE_SIZE + 1)

    if not image_bytes:
        raise HTTPException(
            status_code=400,
            detail="Please select an image.",
        )

    if len(image_bytes) > MAX_PROFILE_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image must be 2 MB or smaller.",
        )

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image_format = image.format

            if image_format not in ALLOWED_IMAGE_FORMATS:
                raise HTTPException(
                    status_code=400,
                    detail="Only JPEG, PNG, and WebP images are allowed.",
                )

            image.verify()

        # Reopen and re-encode the image to remove unwanted embedded content.
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            image.thumbnail((512, 512))

            clean_image = image.convert("RGB")
            filename = f"{uuid.uuid4().hex}.jpg"
            output_path = PROFILE_UPLOAD_DIR / filename

            clean_image.save(
                output_path,
                format="JPEG",
                quality=85,
                optimize=True,
            )

            clean_image.close()

    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid supported image.",
        )

    old_photo_url = customer.photo_url

    customer.photo_url = f"/uploads/profile_photos/{filename}"

    try:
        await db.commit()
        await db.refresh(customer)
    except Exception:
        await db.rollback()
        output_path.unlink(missing_ok=True)
        raise

    # Remove the previous local photo only if it belongs to this upload directory.
    if old_photo_url and old_photo_url.startswith("/uploads/profile_photos/"):
        old_filename = Path(old_photo_url).name
        old_path = (PROFILE_UPLOAD_DIR / old_filename).resolve()

        if old_path.parent == PROFILE_UPLOAD_DIR:
            old_path.unlink(missing_ok=True)

    return CustomerAuthResponse(
        id=customer.id,
        name=customer.name,
        email=customer.email,
        photo_url=customer.photo_url,
        email_verified=customer.email_verified,
        role="customer",
    )

# --------------------------------------------------
# SUPPORT TICKETS
# --------------------------------------------------


@app.get(
        "/tickets",
        dependencies=[Depends(get_current_admin)],
        )
async def list_all_tickets(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportTicket).order_by(
            SupportTicket.created_at.desc()
        )
    )
    tickets = result.scalars().all()

    return [
        {
            "id": ticket.id,
            "customer_id": ticket.customer_id,
            "conversation_id": ticket.conversation_id,
            "subject": ticket.subject,
            "description": ticket.description,
            "status": ticket.status,
            "created_at": ticket.created_at,
        }
        for ticket in tickets
    ]



@app.post("/tickets")
async def create_support_ticket(
    request: TicketRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    # Verify the conversation belongs to the authenticated customer.
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == request.conversation_id,
            Conversation.customer_id == customer.id,
        )
    )
    conversation = result.scalar_one_or_none()

    if conversation is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found for this customer",
        )

    # Create the ticket using the authenticated customer's ID.
    ticket = await create_ticket(
        db=db,
        customer_id=customer.id,
        conversation_id=conversation.id,
        subject=request.subject.strip(),
        description=request.description.strip(),
    )

    # Preserve activity logging.
    await log_activity(
        db=db,
        event_type="ticket_created",
        description=f"Support ticket #{ticket.id} was created.",
        entity_type="ticket",
        entity_id=ticket.id,
    )

    await db.commit()
    await db.refresh(ticket)

    return {
        "message": "Support ticket created",
        "ticket_id": ticket.id,
        "status": ticket.status,
    }






@app.get("/customer/tickets")
async def get_customer_tickets(
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.customer_id == customer.id)
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = result.scalars().all()

    return [
        {
            "id": ticket.id,
            "customer_id": ticket.customer_id,
            "conversation_id": ticket.conversation_id,
            "subject": ticket.subject,
            "description": ticket.description,
            "status": ticket.status,
            "created_at": ticket.created_at,
        }
        for ticket in tickets
    ]


@app.patch(
        "/tickets/{ticket_id}",
        dependencies=[Depends(get_current_admin)],
        )
async def update_ticket_status(
    ticket_id: int,
    request: TicketStatusUpdate,
    db: AsyncSession = Depends(get_db),
):
    ticket = await db.get(SupportTicket, ticket_id)

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Support ticket not found",
        )

    old_status = ticket.status
    ticket.status = request.status

    # Log only actual status changes.
    if old_status != request.status:
        await log_activity(
            db=db,
            event_type="ticket_status_changed",
            description=(
                f"Support ticket #{ticket.id} status changed "
                f"from {old_status} to {request.status}."
            ),
            entity_type="ticket",
            entity_id=ticket.id,
        )

    await db.commit()
    await db.refresh(ticket)

    return {
        "message": "Ticket status updated successfully",
        "ticket_id": ticket.id,
        "status": ticket.status,
    }


# --------------------------------------------------
# ADMIN STATISTICS
# --------------------------------------------------


@app.get(
        "/admin/stats",
        dependencies=[Depends(get_current_admin)],
        )
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
):
    customers_result = await db.execute(
        select(func.count()).select_from(Customer)
    )

    conversations_result = await db.execute(
        select(func.count()).select_from(Conversation)
    )

    tickets_result = await db.execute(
        select(func.count()).select_from(SupportTicket)
    )

    open_tickets_result = await db.execute(
        select(func.count())
        .select_from(SupportTicket)
        .where(SupportTicket.status == "open")
    )

    documents_result = await db.execute(
        select(func.count()).select_from(Document)
    )

    return {
        "customers": customers_result.scalar_one(),
        "conversations": conversations_result.scalar_one(),
        "tickets": tickets_result.scalar_one(),
        "open_tickets": open_tickets_result.scalar_one(),
        "documents": documents_result.scalar_one(),
    }


# --------------------------------------------------
# DOCUMENT UPLOAD
# --------------------------------------------------


@app.post(
        "/documents/upload",
        dependencies=[Depends(get_current_admin)],
        )
async def upload_document(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required",
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    temp_path = None

    try:
        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty",
            )

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File size exceeds the 25 MB limit",
            )

        file_hash = hashlib.sha256(content).hexdigest()

        # Check for duplicate files and document limit.
        async with SessionLocal() as db:
            result = await db.execute(
                select(Document).where(Document.file_hash == file_hash)
            )

            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=409,
                    detail="This document has already been uploaded",
                )

            result = await db.execute(select(Document.id))
            document_count = len(result.scalars().all())

            if document_count >= MAX_DOCUMENTS:
                raise HTTPException(
                    status_code=403,
                    detail="Document limit reached",
                )

        # Temporarily save the PDF.
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".pdf",
        ) as temp_file:
            temp_path = temp_file.name
            temp_file.write(content)

        pages = extract_pages_from_pdf(temp_path)

        if not pages:
            raise HTTPException(
                status_code=400,
                detail="No readable text found in PDF",
            )

        # Ingest the document, then record the activity.
        async with SessionLocal() as db:
            document_id = await ingest_document(
                db=db,
                filename=file.filename,
                file_hash=file_hash,
                pages=pages,
            )

            await log_activity(
                db=db,
                event_type="document_uploaded",
                description=(
                    f"Knowledge document '{file.filename}' was uploaded."
                ),
                entity_type="document",
                entity_id=document_id,
            )

            await db.commit()

        return {
            "message": "Document uploaded successfully",
            "document_id": document_id,
            "filename": file.filename,
            "pages": len(pages),
        }

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.get(
        "/documents",
        dependencies=[Depends(get_current_admin)],
        )
async def list_documents():
    async with SessionLocal() as db:
        result = await db.execute(
            select(Document).order_by(Document.created_at.desc())
        )
        documents = result.scalars().all()

        return [
            {
                "id": document.id,
                "filename": document.filename,
                "created_at": document.created_at,
            }
            for document in documents
        ]


@app.delete(
        "/documents/{document_id}",
        dependencies=[Depends(get_current_admin)],
        )
async def delete_document(document_id: int):
    async with SessionLocal() as db:
        document = await db.get(Document, document_id)

        if document is None:
            raise HTTPException(
                status_code=404,
                detail="Document not found",
            )

        filename = document.filename

        await db.delete(document)

        await log_activity(
            db=db,
            event_type="document_deleted",
            description=f"Knowledge document '{filename}' was deleted.",
            entity_type="document",
            entity_id=document_id,
        )

        await db.commit()

        return {
            "message": "Document deleted successfully",
            "document_id": document_id,
        }


# --------------------------------------------------
# CUSTOMERS
# --------------------------------------------------


@app.get(
        "/customers",
        dependencies=[Depends(get_current_admin)],
        )
async def list_customers(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).order_by(Customer.id.desc())
    )
    customers = result.scalars().all()

    return [
        {
            "id": customer.id,
            "name": getattr(customer, "name", None),
            "email": getattr(customer, "email", None),
            "created_at": getattr(customer, "created_at", None),
        }
        for customer in customers
    ]


# --------------------------------------------------
# ADMIN AI USAGE
# --------------------------------------------------


@app.get(
        "/admin/usage",
        dependencies=[Depends(get_current_admin)],
        )
async def get_admin_usage(
    db: AsyncSession = Depends(get_db),
):
    totals_result = await db.execute(
        select(
            func.count(AIUsageLog.id).label("total_interactions"),
            func.coalesce(
                func.sum(AIUsageLog.input_tokens), 0
            ).label("input_tokens"),
            func.coalesce(
                func.sum(AIUsageLog.output_tokens), 0
            ).label("output_tokens"),
            func.coalesce(
                func.sum(AIUsageLog.total_tokens), 0
            ).label("total_tokens"),
        )
    )
    totals = totals_result.one()

    operations_result = await db.execute(
        select(
            AIUsageLog.operation,
            func.count(AIUsageLog.id).label("interactions"),
            func.coalesce(
                func.sum(AIUsageLog.input_tokens), 0
            ).label("input_tokens"),
            func.coalesce(
                func.sum(AIUsageLog.output_tokens), 0
            ).label("output_tokens"),
            func.coalesce(
                func.sum(AIUsageLog.total_tokens), 0
            ).label("total_tokens"),
        )
        .group_by(AIUsageLog.operation)
        .order_by(func.sum(AIUsageLog.total_tokens).desc())
    )

    operations = [
        {
            "operation": row.operation,
            "interactions": row.interactions,
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
            "total_tokens": row.total_tokens,
        }
        for row in operations_result.all()
    ]

    recent_result = await db.execute(
        select(AIUsageLog)
        .order_by(AIUsageLog.created_at.desc())
        .limit(50)
    )
    recent_records = recent_result.scalars().all()

    return {
        "summary": {
            "total_interactions": totals.total_interactions,
            "input_tokens": totals.input_tokens,
            "output_tokens": totals.output_tokens,
            "total_tokens": totals.total_tokens,
        },
        "by_operation": operations,
        "recent_records": [
            {
                "id": record.id,
                "conversation_id": record.conversation_id,
                "interaction_id": record.interaction_id,
                "model": record.model,
                "operation": record.operation,
                "input_tokens": record.input_tokens,
                "output_tokens": record.output_tokens,
                "total_tokens": record.total_tokens,
                "created_at": record.created_at,
            }
            for record in recent_records
        ],
    }


# --------------------------------------------------
# ADMIN SYSTEM ACTIVITY
# --------------------------------------------------


@app.get(
        "/admin/activity",
        dependencies=[Depends(get_current_admin)],
        )
async def get_admin_activity(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SystemActivity)
        .order_by(SystemActivity.created_at.desc())
        .limit(100)
    )
    activities = result.scalars().all()

    return [
        {
            "id": activity.id,
            "event_type": activity.event_type,
            "description": activity.description,
            "entity_type": activity.entity_type,
            "entity_id": activity.entity_id,
            "created_at": activity.created_at,
        }
        for activity in activities
    ]
