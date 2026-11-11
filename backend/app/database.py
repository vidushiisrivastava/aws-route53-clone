import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLITE_DB_URL = os.getenv("DATABASE_URL", "sqlite:///./route53.db")
connect_args = {"check_same_thread": False} if SQLITE_DB_URL.startswith("sqlite") else {}
engine = create_engine(SQLITE_DB_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
