"""
database.py — Database connection and session management for IBVAP backend.

Uses SQLite by default for local development, with modular SQLAlchemy design
so that PostgreSQL or another engine can be substituted via DATABASE_URL
without touching application code.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Base directory of the backend package
BASE_DIR = Path(__file__).resolve().parent.parent

# Default to SQLite located at backend/ibvap.db
DEFAULT_DB_FILE = BASE_DIR / "ibvap.db"
DEFAULT_DB_URL = f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# SQLite requires check_same_thread=False for multi-threaded FastAPI access
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a SQLAlchemy database session and
    ensures it is closed after request processing.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Create database tables defined in models.py if they do not already exist.
    """
    # Import models here to ensure they are registered with Base metadata
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
