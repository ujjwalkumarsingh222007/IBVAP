"""
database.py — Database connection and session management for IBVAP backend.

Uses SQLite by default for local development, with modular SQLAlchemy design
so that PostgreSQL or another engine can be substituted via DATABASE_URL
without touching application code.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.config import DATABASE_URL

logger = logging.getLogger("ibvap.database")

# SQLite requires check_same_thread=False and busy timeout for concurrent access
connect_args = (
    {"check_same_thread": False, "timeout": 30.0}
    if DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

# Enable WAL mode, foreign keys, and busy timeout on every SQLite connection
if DATABASE_URL.startswith("sqlite") and not DATABASE_URL.startswith("sqlite:///:memory:"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.close()
        except Exception as exc:
            logger.warning("[DB] Failed to set SQLite PRAGMAs: %s", exc)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a SQLAlchemy database session and
    ensures it is closed after request processing with rollback on error.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    """
    Create database tables defined in models.py if they do not already exist,
    and initialize default admin/operator/viewer accounts safely.
    """
    # Import models here to ensure they are registered with Base metadata
    from app import models  # noqa: F401
    from app.auth.init_admin import init_default_users

    Base.metadata.create_all(bind=engine)
    logger.info("[DB] Connected to database: %s", DATABASE_URL)

    # Initialize users safely
    db = SessionLocal()
    try:
        init_default_users(db)
    except Exception:
        db.rollback()
    finally:
        db.close()
