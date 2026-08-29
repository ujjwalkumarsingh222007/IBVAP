"""
app.auth — Authentication, Authorization, and Security Package for IBVAP.
"""

from app.auth.dependencies import (
    get_current_user,
    get_current_user_optional,
    log_audit_action,
    require_admin,
    require_operator,
    require_viewer,
)
from app.auth.routes import router as auth_router
from app.auth.schemas import (
    AuditLogResponse,
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserRole,
)
from app.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

__all__ = [
    "auth_router",
    "get_current_user",
    "get_current_user_optional",
    "require_admin",
    "require_operator",
    "require_viewer",
    "log_audit_action",
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "UserRole",
    "LoginRequest",
    "TokenResponse",
    "UserCreate",
    "UserResponse",
    "AuditLogResponse",
]
