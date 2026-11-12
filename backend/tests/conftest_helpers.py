"""Shared in-memory database and schema validation helpers for backend tests."""

import sys
from pathlib import Path
from typing import Any, List, Type

from pydantic import TypeAdapter
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app import dependencies, models  # noqa: E402
from app.routers import auth  # noqa: E402


def create_test_session() -> Session:
    """Create a fresh isolated in-memory SQLite Session with all tables initialized."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return TestingSessionLocal()


def create_authenticated_user(
    db: Session, username: str = "tester", password: str = "pass1234"
) -> tuple[models.User, str]:
    """Register and log in a test user, returning (User, bearer_token)."""
    from app import schemas

    auth.register(schemas.UserCreate(username=username, password=password), db=db)
    login_data = auth.login_json(schemas.UserCreate(username=username, password=password), db=db)
    token = login_data["access_token"]
    user = dependencies.get_current_user(token=token, db=db)
    return user, token


def validate_schema(schema_cls: Any, data: Any) -> Any:
    """Validate response dicts/models against a Pydantic schema or typing annotation."""
    return TypeAdapter(schema_cls).validate_python(data)


def validate_list_schema(item_schema: Type[Any], items: list[Any]) -> list[Any]:
    """Validate a list of response objects against List[item_schema]."""
    return TypeAdapter(List[item_schema]).validate_python(items)

