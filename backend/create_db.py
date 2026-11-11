from app.database import engine
from app import models

def main():
    """Create SQLite tables based on SQLAlchemy models."""
    models.Base.metadata.create_all(bind=engine)
    print("[OK] SQLite database and tables created.")

if __name__ == "__main__":
    main()
