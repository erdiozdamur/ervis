import os
import uuid
from typing import Generator

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session, sessionmaker

from models import Base, User
from services.auth_service import create_access_token, decode_access_token, get_password_hash, verify_password

APP_ENV = os.getenv("APP_ENV")
if not APP_ENV:
    raise RuntimeError("APP_ENV is required (e.g. development, staging, production).")

env_file = f".env.{APP_ENV}"
if os.path.exists(env_file):
    load_dotenv(env_file, override=False)


def _build_database_url() -> str | URL:
    raw_database_url = os.getenv("DATABASE_URL")
    if raw_database_url:
        return raw_database_url

    pg_user = os.getenv("POSTGRES_USER")
    pg_password = os.getenv("POSTGRES_PASSWORD")
    pg_db = os.getenv("POSTGRES_DB")
    pg_host = os.getenv("POSTGRES_HOST", "db")
    pg_port = int(os.getenv("POSTGRES_PORT", "5432"))

    if not pg_user or not pg_password or not pg_db:
        raise RuntimeError("DATABASE_URL is required, or set POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB.")

    return URL.create(
        drivername="postgresql+psycopg2",
        username=pg_user,
        password=pg_password,
        host=pg_host,
        port=pg_port,
        database=pg_db,
    )


engine = create_engine(_build_database_url())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _drop_legacy_tables() -> None:
    legacy_tables = [
        "knowledge_chunks",
        "knowledge_documents",
        "memory_facts",
        "query_cache",
        "relations",
        "entities",
        "tasks",
        "chat_messages",
        "conversations",
    ]

    with engine.begin() as conn:
        for table in legacy_tables:
            conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))


def _init_database() -> None:
    _drop_legacy_tables()
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if user is None:
        raise credentials_exception
    return user


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr


app = FastAPI(title="Ervis Auth Core")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    _init_database()


@app.get("/")
def healthcheck() -> dict:
    return {"status": "ok", "service": "auth-core"}


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.post("/api/auth/register")
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=payload.username.strip(),
        email=str(payload.email).lower().strip(),
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "User created", "user": UserResponse(id=str(user.id), username=user.username, email=user.email).model_dump()}


@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == form_data.username.lower().strip()).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": str(user.id),
        "username": user.username,
    }


@app.get("/api/auth/me")
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=str(current_user.id), username=current_user.username, email=current_user.email)
