"""
schemas.py — Pydantic models for authentication, user management, and audit logging.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64, description="User username")
    password: str = Field(..., min_length=1, description="User password")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, description="Unique username")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    role: UserRole = Field(default=UserRole.OPERATOR, description="Assigned role")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    username: str
    action: str
    endpoint: str
    timestamp: datetime
    success: bool
    details: Optional[str] = None
