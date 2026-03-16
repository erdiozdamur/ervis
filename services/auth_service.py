import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv(override=True)

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

import bcrypt
import hashlib

def _pre_hash(password: str) -> bytes:
    """Pre-hash password to bypass bcrypt's 72-character limit and return as bytes."""
    # SHA-256 hex digest is 64 characters, well within bcrypt's 72-byte limit.
    return hashlib.sha256(password.encode()).hexdigest().encode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Passlib might have stored it as a string, checkpw needs bytes
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode()
        
        # Try new hashing method (with pre-hash)
        if bcrypt.checkpw(_pre_hash(plain_password), hashed_password):
            return True
            
        # Fallback to legacy hashing method (without pre-hash)
        # This allows existing users to login
        return bcrypt.checkpw(plain_password.encode(), hashed_password)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    # gensalt() generates a random salt
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(_pre_hash(password), salt)
    return hashed.decode()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
