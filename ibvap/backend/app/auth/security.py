"""
security.py — Cryptographic security, password hashing with bcrypt, and JWT token management with python-jose.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
from jose import JWTError, jwt

from app.config import (
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
)


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt with random salt.
    Never stores plaintext passwords.
    """
    if not password:
        raise ValueError("Password cannot be empty")
    # Truncate to 72 bytes max as per bcrypt specification
    pw_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash.
    Also supports fallback for legacy PBKDF2 hashes if any exist.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        pw_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")

        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$") or hashed_password.startswith("$2y$"):
            return bcrypt.checkpw(pw_bytes, hash_bytes)

        # Fallback for PBKDF2 hash scheme
        if hashed_password.startswith("pbkdf2:"):
            import hashlib
            import hmac
            parts = hashed_password.split("$")
            if len(parts) == 3:
                header, salt_hex, expected_hash_hex = parts
                _, _, iterations_str = header.split(":")
                iterations = int(iterations_str)
                salt = bytes.fromhex(salt_hex)
                expected_hash = bytes.fromhex(expected_hash_hex)
                computed_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
                return hmac.compare_digest(computed_hash, expected_hash)

        return bcrypt.checkpw(pw_bytes, hash_bytes)
    except Exception:
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a signed JWT access token using python-jose containing claims:
    - sub (subject: username or user id)
    - role
    - exp (expiration timestamp)
    - iat (issued at timestamp)
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT access token using python-jose.
    Returns payload dict or None if invalid or expired.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
