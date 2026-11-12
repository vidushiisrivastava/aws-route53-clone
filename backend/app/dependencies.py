import logging
import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from . import models, database

logger = logging.getLogger(__name__)
_DEV_FALLBACK_KEY = "dev-secret-key-route53-clone-32bytes!"
SECRET_KEY = os.getenv("SECRET_KEY", _DEV_FALLBACK_KEY)
if SECRET_KEY == _DEV_FALLBACK_KEY:
    if os.getenv("ENV", "").lower() == "production":
        raise RuntimeError("SECRET_KEY must be set in production")
    logger.warning("Using default development SECRET_KEY; set SECRET_KEY env var in production.")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db),
) -> models.User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def get_owned_resource(db: Session, model, resource_id: int, current_user: models.User, detail: str):
    """Fetch a resource owned by current_user (or legacy unowned row) or raise 404."""
    obj = (
        db.query(model)
        .filter(
            model.id == resource_id,
            (model.owner_id == current_user.id) | (model.owner_id.is_(None)),
        )
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail=detail)
    return obj
