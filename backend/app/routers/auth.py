from datetime import datetime, timedelta
import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas, database
from ..dependencies import SECRET_KEY, ALGORITHM, get_current_user

ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days session persistence

router = APIRouter(prefix="/auth", tags=["auth"])


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_or_create_demo_user(db: Session) -> models.User:
    user = db.query(models.User).filter(models.User.id == 1).first()
    if not user:
        user = db.query(models.User).filter(models.User.username.in_(["demo", "Vidushi"])).first()
    if not user:
        user = models.User(
            username="Vidushi",
            hashed_password=get_password_hash("demo1234"),
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post("/register", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="IAM username already exists")
    hashed = get_password_hash(user.password)
    db_user = models.User(username=user.username.strip(), hashed_password=hashed)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    get_or_create_demo_user(db)
    # Allow 'demo' alias for demo account id=1
    lookup_name = form_data.username.strip()
    user = db.query(models.User).filter(models.User.username == lookup_name).first()
    if not user and lookup_name.lower() == "demo":
        user = db.query(models.User).filter(models.User.id == 1).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect IAM username or password")

    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "account_id": "1793-0234-9211"},
    }


@router.post("/login-json")
def login_json(payload: schemas.UserCreate, db: Session = Depends(database.get_db)):
    get_or_create_demo_user(db)
    lookup_name = payload.username.strip()
    user = db.query(models.User).filter(models.User.username == lookup_name).first()
    if not user and lookup_name.lower() == "demo":
        user = db.query(models.User).filter(models.User.id == 1).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect IAM username or password")

    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "account_id": "1793-0234-9211"},
    }


@router.post("/demo")
def demo_login(db: Session = Depends(database.get_db)):
    user = get_or_create_demo_user(db)
    access_token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "account_id": "1793-0234-9211"},
    }


@router.get("/me")
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "account_id": "1793-0234-9211",
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
    }
