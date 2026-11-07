
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# =========================================================
# Chat Schemas — Existing Functionality
# =========================================================


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10000)
    conversation_id: int | None = None
    visitor_id: str | None = Field(default=None, min_length=1, max_length=100)

class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=128)


class Source(BaseModel):
    document: str
    page: int | None


class RAGResponse(BaseModel):
    answer: str
    sources: list[Source]


class AIResponse(BaseModel):
    answer: str
    status: Literal["answered", "insufficient_information"]


class ChatResponse(BaseModel):
    response: str
    sources: list[Source]
    conversation_id: int


# =========================================================
# Authentication Schemas
# =========================================================

class CustomerSignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Name cannot be empty.")

        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if value != value.strip():
            raise ValueError("Password cannot start or end with whitespace.")

        if len(value.encode("utf-8")) > 1024:
            raise ValueError("Password is too long.")

        return value


class CustomerLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CustomerAuthResponse(BaseModel):
    id: int
    name: str | None
    email: EmailStr
    photo_url: str | None = None
    email_verified: bool
    role: Literal["customer"] = "customer"

    model_config = ConfigDict(from_attributes=True)


class AuthStatusResponse(BaseModel):
    authenticated: bool
    customer: CustomerAuthResponse | None = None


class MessageResponse(BaseModel):
    message: str




class CustomerProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Name cannot be empty.")

        return value
