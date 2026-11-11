import bcrypt
from sqlalchemy.orm import Session
from app import models, database

def get_password_hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode()

def main():
    db: Session = next(database.get_db())
    # Check if admin exists
    existing = db.query(models.User).filter(models.User.username == "admin").first()
    if existing:
        print("Admin user already exists.")
        return
    admin = models.User(
        username="admin",
        hashed_password=get_password_hash("password"),
        is_active=True,
    )
    db.add(admin)
    db.commit()
    print("[OK] Demo admin user 'admin' created (password: 'password').")

if __name__ == "__main__":
    main()
