import os

from sqlalchemy import create_engine, text
from models import Base

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required.")

def init_db():
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        conn.commit()
    
    print("Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Creating updated schema...")
    Base.metadata.create_all(bind=engine)
    
    print("Database schema recreated successfully.")

if __name__ == "__main__":
    init_db()
