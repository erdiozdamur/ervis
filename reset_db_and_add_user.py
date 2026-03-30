import os
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from models import Base, User
from services.auth_service import get_password_hash

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required.")

SEED_USERNAME = os.getenv("ERVIS_SEED_USERNAME")
SEED_EMAIL = os.getenv("ERVIS_SEED_EMAIL")
SEED_PASSWORD = os.getenv("ERVIS_SEED_PASSWORD")


def _require_seed_env() -> None:
    missing = []
    if not SEED_USERNAME:
        missing.append("ERVIS_SEED_USERNAME")
    if not SEED_EMAIL:
        missing.append("ERVIS_SEED_EMAIL")
    if not SEED_PASSWORD:
        missing.append("ERVIS_SEED_PASSWORD")

    if missing:
        raise RuntimeError(
            "Missing required environment variables: " + ", ".join(missing)
        )

def reset_and_init():
    _require_seed_env()
    engine = create_engine(DATABASE_URL)
    
    print("🔨 Enabling vector extension and ensuring schema exists...")
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    Base.metadata.create_all(bind=engine)
    
    print("🧹 Truncating all tables (keeping schema)...")
    with engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE users, entities, relations, query_cache, tasks CASCADE;"))
        conn.commit()
    
    print(f"👤 Creating user: {SEED_USERNAME}...")
    with Session(engine) as session:
        new_user = User(
            id=uuid.uuid4(),
            username=SEED_USERNAME,
            email=SEED_EMAIL,
            password_hash=get_password_hash(SEED_PASSWORD)
        )
        session.add(new_user)
        session.commit()
        print(f"✅ User created successfully with ID: {new_user.id}")

if __name__ == "__main__":
    reset_and_init()
