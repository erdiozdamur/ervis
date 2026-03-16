import os
import uuid

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from models import Base, User

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://ervis:ervis_password@localhost:5432/ervis_core"
)

def init_db():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    print("Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Creating updated schema...")
    Base.metadata.create_all(bind=engine)
    
    with Session(engine) as session:
        default_user = User(
            id=uuid.UUID("0c7707c0-b5c0-427a-b76c-0d9568c35487"),
            username="ervis_admin",
            email="admin@ervis.local",
            password_hash="dummy_hash_for_testing"
        )
        session.add(default_user)
        session.commit()
        
    print("Database schema recreated and default test user added successfully.")

if __name__ == "__main__":
    init_db()
