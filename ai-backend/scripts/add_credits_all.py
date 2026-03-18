"""
Add 100 credits to all users (for testing).
Run: cd ai-backend && python scripts/add_credits_all.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, init_db
from app.models import User

CREDITS = 100


def main():
    init_db()
    db = SessionLocal()
    try:
        users = db.query(User).all()
        for u in users:
            u.credits = CREDITS
        db.commit()
        print(f"Set {len(users)} user(s) to {CREDITS} credits")
    finally:
        db.close()


if __name__ == "__main__":
    main()
