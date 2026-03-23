import os
import sys
from sqlalchemy import create_engine, text

def test_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL is not set in environment.")
        return

    print(f"Attempting to connect to: {db_url.split('@')[-1]} (password masked)")
    
    try:
        engine = create_engine(db_url)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();")).fetchone()
            print(f"✅ Connection successful!")
            print(f"Database version: {result[0]}")
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        if "password authentication failed" in str(e).lower():
            print("\n💡 TIP: Possible password mismatch. Try updating the password using 'docker exec' or check Dokploy environment variables.")

if __name__ == "__main__":
    test_connection()
