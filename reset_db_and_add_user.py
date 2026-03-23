import os
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from models import Base, User
from services.auth_service import get_password_hash

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://ervis:ervis_password@localhost:5432/ervis_core"
)

def reset_and_init():
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
    
    print("👤 Creating user: Erdi Özdamur...")
    with Session(engine) as session:
        new_user = User(
            id=uuid.uuid4(),
            username="Erdi Özdamur",
            email="e.ozdamur@gmail.com",
            password_hash=get_password_hash("Erdi1903")
        )
        session.add(new_user)
        session.commit()
        print(f"✅ User created successfully with ID: {new_user.id}")

if __name__ == "__main__":
    reset_and_init()
