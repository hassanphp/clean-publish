"""
Seed script: create admin user for development.
Run: cd ai-backend && source venv/bin/activate && python -m app.seed
"""
import os
import sys

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bcrypt
from sqlalchemy import text
from app.database import DATABASE_URL, SessionLocal, init_db, engine
from app.models import User

ADMIN_EMAIL = "dealer@domain.com"
ADMIN_PASSWORD = "Admin@321"
ADMIN_NAME = "Admin Dealer"


def ensure_schema():
    """Add missing user columns if schema is outdated (SQLite only)."""
    if "sqlite" not in (DATABASE_URL or "").lower():
        return
    with engine.connect() as conn:
        try:
            r = conn.execute(text("PRAGMA table_info(users)"))
        except Exception:
            return  # Table may not exist
        cols = [row[1] for row in r.fetchall()]
        for col, typ in [("password_hash", "VARCHAR(255)"), ("name", "VARCHAR(255)"), ("credits", "INTEGER DEFAULT 0")]:
            if col not in cols:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typ}"))
        conn.commit()


def seed_admin():
    """Create admin user if not exists."""
    init_db()  # Ensure tables exist
    ensure_schema()  # Add missing columns if needed
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if existing:
            print(f"Admin user already exists: {ADMIN_EMAIL}")
            return
        user = User(
            email=ADMIN_EMAIL,
            password_hash=bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode(),
            name=ADMIN_NAME,
            credits=100,  # Give some credits for testing
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created admin user: {ADMIN_EMAIL} (id={user.id})")
        print("  Password: Admin@321")
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin()
