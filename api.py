import os
import io
import uuid
import traceback
from datetime import datetime, timedelta, timezone
from typing import List
from typing import Optional, Dict, Any

from dotenv import load_dotenv
# Load environment variables from environment-specific file if present.
APP_ENV = os.getenv("APP_ENV")
if not APP_ENV:
    raise RuntimeError("APP_ENV is required (e.g. development, staging, production).")

env_file = f".env.{APP_ENV}"
if os.path.exists(env_file):
    load_dotenv(env_file, override=False)

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text, select, delete, func
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker, Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from openai import AuthenticationError as OpenAIAuthenticationError
from pypdf import PdfReader

from services.llm_router import analyze_user_input, IntentType
from services.memory_agent import extract_knowledge, store_knowledge
from services.retrieval_agent import answer_query
from services.tool_agent import execute_tool_for_user
from services.cache_service import check_cache, save_to_cache, clear_user_cache, delete_stale_cache, check_dynamic_status
from services.web_search_agent import search_the_web
from services.auth_service import verify_password, get_password_hash, create_access_token, decode_access_token
from services.memory_observer import passive_memory_observation
from models import User, Base, ChatMessage, Conversation, MemoryFact
from models import KnowledgeChunk
from services.knowledge_service import (
    upsert_document_with_chunks,
    retrieve_knowledge_context,
    list_documents,
    delete_document,
)

# Database Setup
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
        raise RuntimeError(
            "DATABASE_URL is required, or set POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB."
        )

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

# Auto-create tables on startup (safe for production - only creates if not exists)
def _init_database():
    import time
    def _local_int_env(name: str, default: int, min_value: int, max_value: int) -> int:
        raw = os.getenv(name)
        if raw is None:
            return default
        try:
            parsed = int(raw)
        except ValueError:
            return default
        return max(min_value, min(parsed, max_value))

    max_retries = _local_int_env("DB_INIT_MAX_RETRIES", default=24, min_value=3, max_value=120)
    retry_delay = _local_int_env("DB_INIT_RETRY_DELAY_SECONDS", default=5, min_value=1, max_value=30)
    last_error = None
    for attempt in range(max_retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
            Base.metadata.create_all(bind=engine)
            with engine.connect() as conn:
                # Lightweight startup migration for legacy databases.
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS conversations (
                        id UUID PRIMARY KEY,
                        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        title VARCHAR NOT NULL DEFAULT 'Yeni Oturum',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """))
                conn.execute(text("""
                    ALTER TABLE chat_messages
                    ADD COLUMN IF NOT EXISTS conversation_id UUID;
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_conversations_user_last_message_at
                    ON conversations (user_id, last_message_at DESC);
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_chat_messages_conversation_created_at
                    ON chat_messages (conversation_id, created_at);
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS memory_facts (
                        id UUID PRIMARY KEY,
                        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        entity_id UUID NULL REFERENCES entities(id) ON DELETE CASCADE,
                        relation_id UUID NULL REFERENCES relations(id) ON DELETE CASCADE,
                        source_message_id UUID NULL REFERENCES chat_messages(id) ON DELETE SET NULL,
                        fact_text VARCHAR NOT NULL,
                        fact_status VARCHAR NOT NULL DEFAULT 'confirmed',
                        confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.7,
                        evidence_text VARCHAR NULL,
                        observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        last_confirmed_at TIMESTAMPTZ NULL,
                        embedding vector(1536) NULL
                    );
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_memory_facts_user_observed_at
                    ON memory_facts (user_id, observed_at DESC);
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_memory_facts_user_status
                    ON memory_facts (user_id, fact_status);
                """))
                conn.execute(text("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1
                            FROM pg_constraint
                            WHERE conname = 'fk_chat_messages_conversation_id'
                        ) THEN
                            ALTER TABLE chat_messages
                            ADD CONSTRAINT fk_chat_messages_conversation_id
                            FOREIGN KEY (conversation_id)
                            REFERENCES conversations(id)
                            ON DELETE CASCADE;
                        END IF;
                    END
                    $$;
                """))
                conn.commit()
            print("✅ Database schema verified/created successfully.")
            _backfill_legacy_conversations()
            return
        except Exception as e:
            last_error = e
            print(f"⚠️ Database init attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                print(f"🔄 Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("❌ Max retries reached. Database initialization failed.")
    raise RuntimeError(f"Database initialization failed after {max_retries} attempts: {last_error}")

def _int_env(name: str, default: int, min_value: int, max_value: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        return default
    return max(min_value, min(parsed, max_value))


MAX_STORED_CHAT_MESSAGES_PER_USER = _int_env(
    "CHAT_HISTORY_MAX_MESSAGES_PER_USER",
    default=200,
    min_value=20,
    max_value=2000,
)
DEFAULT_HISTORY_FETCH_LIMIT = _int_env(
    "CHAT_HISTORY_DEFAULT_FETCH_LIMIT",
    default=40,
    min_value=10,
    max_value=120,
)
MAX_HISTORY_FETCH_LIMIT = _int_env(
    "CHAT_HISTORY_MAX_FETCH_LIMIT",
    default=80,
    min_value=20,
    max_value=200,
)
MAX_STORED_CHAT_MESSAGE_CHARS = _int_env(
    "CHAT_HISTORY_MESSAGE_MAX_CHARS",
    default=3000,
    min_value=300,
    max_value=20000,
)
DEFAULT_CONVERSATION_FETCH_LIMIT = _int_env(
    "CHAT_CONVERSATION_DEFAULT_FETCH_LIMIT",
    default=20,
    min_value=5,
    max_value=100,
)
MAX_CONVERSATION_FETCH_LIMIT = _int_env(
    "CHAT_CONVERSATION_MAX_FETCH_LIMIT",
    default=40,
    min_value=10,
    max_value=200,
)

def get_db():
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
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

# Background Task Wrapper
def _find_source_message_id(db: Session, user_id: uuid.UUID, conversation_id: Optional[uuid.UUID], message: str) -> Optional[uuid.UUID]:
    stmt = select(ChatMessage.id).where(
        ChatMessage.user_id == user_id,
        ChatMessage.role == "user",
        ChatMessage.content == message,
    )
    if conversation_id:
        stmt = stmt.where(ChatMessage.conversation_id == conversation_id)
    stmt = stmt.order_by(ChatMessage.created_at.desc()).limit(1)
    return db.execute(stmt).scalars().first()


async def background_memory_extraction(user_id: uuid.UUID, message: str, conversation_id: Optional[uuid.UUID] = None):
    """
    Handles memory extraction and storage in the background with a fresh DB session.
    """
    db = SessionLocal()
    try:
        # 1. Extract knowledge graph
        extraction, model_name = await extract_knowledge(message)
        source_message_id = _find_source_message_id(db, user_id, conversation_id, message)
        # 2. Store in DB with isolation
        await store_knowledge(
            user_id=user_id,
            extraction=extraction,
            db_session=db,
            source_message_id=source_message_id,
        )
        print(f"Background memory extraction completed for user {user_id} using {model_name}")
    except Exception as e:
        print(f"Background memory error: {str(e)}")
    finally:
        db.close()

async def background_passive_observation(
    user_id: uuid.UUID,
    message: str,
    response: str,
    conversation_id: Optional[uuid.UUID] = None,
):
    """
    Handles passive memory observation in the background.
    """
    db = SessionLocal()
    try:
        source_message_id = _find_source_message_id(db, user_id, conversation_id, message)
        await passive_memory_observation(user_id, message, response, db, source_message_id=source_message_id)
    except Exception as e:
        print(f"Background observation error: {str(e)}")
    finally:
        db.close()

def store_chat_pair(
    db: Session,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user_message: str,
    assistant_message: str,
    intent: Optional[str],
    model_used: Optional[str],
):
    """
    Persist a compact chat history while keeping a strict per-user cap.
    """
    def _compact_message_content(content: str) -> str:
        normalized = (content or "").strip()
        if len(normalized) <= MAX_STORED_CHAT_MESSAGE_CHARS:
            return normalized
        return normalized[:MAX_STORED_CHAT_MESSAGE_CHARS].rstrip() + "…"

    safe_user_message = _compact_message_content(user_message)
    safe_assistant_message = _compact_message_content(assistant_message)
    if not safe_user_message:
        safe_user_message = "(empty)"
    if not safe_assistant_message:
        safe_assistant_message = "(empty)"

    try:
        db.add(
            ChatMessage(
                user_id=user_id,
                conversation_id=conversation_id,
                role="user",
                content=safe_user_message,
                intent=intent,
                created_at=datetime.now(timezone.utc),
            )
        )
        db.add(
            ChatMessage(
                user_id=user_id,
                conversation_id=conversation_id,
                role="assistant",
                content=safe_assistant_message,
                intent=intent,
                model_used=model_used,
                created_at=datetime.now(timezone.utc) + timedelta(microseconds=1),
            )
        )
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        ).first()
        if conv:
            if _is_default_conversation_title(conv.title):
                conv.title = _title_from_message(safe_user_message)
            conv.last_message_at = datetime.now(timezone.utc)
        db.commit()

        total_count = db.execute(
            select(func.count()).select_from(ChatMessage).where(ChatMessage.user_id == user_id)
        ).scalar_one()
        excess_count = max(0, int(total_count) - MAX_STORED_CHAT_MESSAGES_PER_USER)

        if excess_count > 0:
            oldest_ids = db.execute(
                select(ChatMessage.id)
                .where(ChatMessage.user_id == user_id)
                .order_by(ChatMessage.created_at.asc())
                .limit(excess_count)
            ).scalars().all()
            if oldest_ids:
                db.execute(delete(ChatMessage).where(ChatMessage.id.in_(oldest_ids)))
                db.commit()
    except Exception as e:
        db.rollback()
        print(f"Chat history error: {str(e)}")

# FastAPI Application
app = FastAPI(title="Ervis Core API", version="1.0.0")

# CORS Middleware for Frontend Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://er-di.info",
        "https://test.er-di.info",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class ChatRequest(BaseModel):
    user_id: uuid.UUID = Field(..., description="The UUID of the tenant/user making the request.")
    message: str = Field(..., description="The user's raw text input.")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional situational metadata (e.g., location, time).")
    conversation_id: Optional[uuid.UUID] = Field(None, description="Optional active conversation identifier.")
    attachments: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Optional chat attachments as extracted text blocks.",
    )

class ChatResponse(BaseModel):
    intent: str
    message: str
    model_used: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    knowledge_sources: Optional[List[Dict[str, Any]]] = None
    conversation_id: Optional[uuid.UUID] = None


class ChatAttachmentExtractResponse(BaseModel):
    filename: str
    mime_type: str
    content: str
    char_count: int


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = None


class ConversationUpdateRequest(BaseModel):
    title: str


class ConversationItem(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    last_message_at: datetime

class ChatHistoryItem(BaseModel):
    role: str
    content: str
    model_used: Optional[str] = None
    intent: Optional[str] = None
    timestamp: datetime

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: uuid.UUID
    username: str


class MemoryMetricsResponse(BaseModel):
    total_facts: int
    confirmed_facts: int
    uncertain_facts: int
    stale_fact_ratio: float
    contradiction_rate: float


class KnowledgeDocumentIngestRequest(BaseModel):
    title: str
    content: str
    source_type: str = "manual"
    source_ref: Optional[str] = None
    domain: Optional[str] = None
    product: Optional[str] = None
    language: Optional[str] = "tr"
    version_tag: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None


class KnowledgeDocumentItem(BaseModel):
    id: uuid.UUID
    title: str
    source_type: str
    source_ref: Optional[str]
    domain: Optional[str]
    product: Optional[str]
    language: Optional[str]
    version_tag: Optional[str]
    summary: Optional[str]
    chunk_count: int
    updated_at: datetime


def _extract_text_from_uploaded_file(file_name: str, payload: bytes) -> str:
    ext = (file_name.rsplit(".", 1)[-1] if "." in file_name else "").lower()
    if ext == "pdf":
        reader = PdfReader(io.BytesIO(payload))
        pages: List[str] = []
        for page in reader.pages:
            pages.append((page.extract_text() or "").strip())
        return "\n\n".join([p for p in pages if p]).strip()
    try:
        return payload.decode("utf-8", errors="ignore").strip()
    except Exception:
        return ""


def _compose_message_with_attachments(base_message: str, attachments: Optional[List[Dict[str, str]]]) -> str:
    safe_message = (base_message or "").strip()
    if not attachments:
        return safe_message

    blocks: list[str] = []
    for item in attachments:
        if not isinstance(item, dict):
            continue
        content = (item.get("content") or "").strip()
        if not content:
            continue
        filename = (item.get("filename") or "ek-dosya").strip()[:120]
        mime_type = (item.get("mime_type") or "application/octet-stream").strip()[:120]
        blocks.append(f"[EK DOSYA]\nDosya: {filename}\nTür: {mime_type}\nİçerik:\n{content[:12000]}")

    if not blocks:
        return safe_message

    return f"{safe_message}\n\n[EKLER]\n" + "\n\n".join(blocks)

def _store_chat_history_now(
    db: Session,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    user_message: str,
    assistant_message: str,
    intent: Optional[str],
    model_used: Optional[str],
):
    store_chat_pair(
        db,
        user_id,
        conversation_id,
        user_message,
        assistant_message,
        intent,
        model_used,
    )


def _get_recent_conversation_messages(
    db: Session,
    user_id: uuid.UUID,
    conversation_id: uuid.UUID,
    limit: int = 8,
) -> list[dict[str, str]]:
    rows = db.execute(
        select(ChatMessage.role, ChatMessage.content)
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.conversation_id == conversation_id,
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(max(1, min(limit, 20)))
    ).all()

    return [
        {"role": role, "content": (content or "")[:2500]}
        for role, content in reversed(rows)
    ]


def _title_from_message(message: str) -> str:
    cleaned = " ".join((message or "").strip().split())
    if not cleaned:
        return "Yeni Oturum"
    return cleaned[:60]


def _is_default_conversation_title(title: Optional[str]) -> bool:
    normalized = (title or "").strip().lower()
    return normalized in {"", "yeni oturum", "new session", "new chat"}


def _create_conversation_for_user(db: Session, user_id: uuid.UUID, first_message: Optional[str] = None) -> Conversation:
    now = datetime.now(timezone.utc)
    conv = Conversation(
        user_id=user_id,
        title=_title_from_message(first_message or ""),
        created_at=now,
        last_message_at=now,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def _resolve_conversation(
    db: Session,
    user_id: uuid.UUID,
    requested_conversation_id: Optional[uuid.UUID],
    fallback_message_for_title: Optional[str],
) -> Conversation:
    if requested_conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == requested_conversation_id,
            Conversation.user_id == user_id,
        ).first()
        if conv:
            return conv
        raise HTTPException(status_code=404, detail="Conversation not found")

    latest = db.query(Conversation).filter(
        Conversation.user_id == user_id
    ).order_by(Conversation.last_message_at.desc()).first()
    if latest:
        return latest

    return _create_conversation_for_user(db, user_id, fallback_message_for_title)


def _backfill_legacy_conversations():
    db = SessionLocal()
    try:
        users_with_legacy_rows = db.execute(
            select(ChatMessage.user_id)
            .where(ChatMessage.conversation_id.is_(None))
            .distinct()
        ).scalars().all()
        if not users_with_legacy_rows:
            return

        for user_id in users_with_legacy_rows:
            oldest = db.execute(
                select(ChatMessage.content)
                .where(ChatMessage.user_id == user_id, ChatMessage.conversation_id.is_(None))
                .order_by(ChatMessage.created_at.asc())
                .limit(1)
            ).scalar_one_or_none()
            conv = _create_conversation_for_user(db, user_id, oldest or "Legacy Oturum")
            db.execute(
                text("""
                    UPDATE chat_messages
                    SET conversation_id = :conversation_id
                    WHERE user_id = :user_id
                      AND conversation_id IS NULL
                """),
                {"conversation_id": str(conv.id), "user_id": str(user_id)},
            )
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Legacy conversation backfill error: {str(e)}")
    finally:
        db.close()


_startup_init_error: Optional[str] = None


@app.on_event("startup")
def startup_initialize_database():
    global _startup_init_error
    try:
        _init_database()
        _startup_init_error = None
    except Exception as exc:
        _startup_init_error = str(exc)
        print(f"❌ Startup database initialization failed: {_startup_init_error}")

@app.get("/healthz")
def healthz():
    """Lightweight liveness probe that does not require external dependencies."""
    return {"status": "ok"}


@app.get("/readyz")
def readyz(db: Session = Depends(get_db)):
    """Readiness probe that verifies database connectivity."""
    if _startup_init_error:
        raise HTTPException(status_code=503, detail=f"startup init failed: {_startup_init_error}")
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.post("/api/chat/conversations", response_model=ConversationItem)
async def create_conversation(
    request: ConversationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _create_conversation_for_user(db, current_user.id, request.title)
    return ConversationItem(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        last_message_at=conv.last_message_at,
    )


@app.get("/api/chat/conversations", response_model=List[ConversationItem])
async def list_conversations(
    limit: int = DEFAULT_CONVERSATION_FETCH_LIMIT,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    safe_limit = max(1, min(limit, MAX_CONVERSATION_FETCH_LIMIT))
    rows = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.last_message_at.desc()).limit(safe_limit).all()
    return [
        ConversationItem(
            id=row.id,
            title=row.title,
            created_at=row.created_at,
            last_message_at=row.last_message_at,
        )
        for row in rows
    ]


@app.patch("/api/chat/conversations/{conversation_id}", response_model=ConversationItem)
async def update_conversation(
    conversation_id: uuid.UUID,
    request: ConversationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.title = _title_from_message(request.title)
    db.commit()
    db.refresh(conv)
    return ConversationItem(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        last_message_at=conv.last_message_at,
    )


@app.get("/api/chat/conversations/{conversation_id}/messages", response_model=List[ChatHistoryItem])
async def get_conversation_messages(
    conversation_id: uuid.UUID,
    limit: int = DEFAULT_HISTORY_FETCH_LIMIT,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    safe_limit = max(1, min(limit, MAX_HISTORY_FETCH_LIMIT))
    rows = db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id, ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(safe_limit)
    ).scalars().all()
    rows.reverse()
    return [
        ChatHistoryItem(
            role=row.role,
            content=row.content,
            model_used=row.model_used,
            intent=row.intent,
            timestamp=row.created_at,
        )
        for row in rows
    ]


@app.delete("/api/chat/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.execute(delete(ChatMessage).where(ChatMessage.conversation_id == conversation_id))
    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}

@app.get("/api/chat/history", response_model=List[ChatHistoryItem])
async def get_chat_history(
    limit: int = DEFAULT_HISTORY_FETCH_LIMIT,
    conversation_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if conversation_id is None:
        conv = db.query(Conversation).filter(
            Conversation.user_id == current_user.id
        ).order_by(Conversation.last_message_at.desc()).first()
        if not conv:
            return []
        conversation_id = conv.id

    safe_limit = max(1, min(limit, MAX_HISTORY_FETCH_LIMIT))
    rows = db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id, ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(safe_limit)
    ).scalars().all()

    # Return ascending order for direct rendering in UI.
    rows.reverse()
    return [
        ChatHistoryItem(
            role=row.role,
            content=row.content,
            model_used=row.model_used,
            intent=row.intent,
            timestamp=row.created_at,
        )
        for row in rows
    ]

@app.delete("/api/chat/history")
async def clear_chat_history(
    conversation_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if conversation_id is None:
        db.execute(delete(ChatMessage).where(ChatMessage.user_id == current_user.id))
        db.execute(delete(Conversation).where(Conversation.user_id == current_user.id))
        db.commit()
        return {"message": "All chat history cleared"}

    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.execute(delete(ChatMessage).where(ChatMessage.conversation_id == conversation_id))
    db.commit()
    return {"message": "Conversation history cleared"}


@app.get("/api/memory/metrics", response_model=MemoryMetricsResponse)
async def memory_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_facts = db.execute(
        select(func.count()).select_from(MemoryFact).where(MemoryFact.user_id == current_user.id)
    ).scalar_one()
    confirmed_facts = db.execute(
        select(func.count()).select_from(MemoryFact).where(
            MemoryFact.user_id == current_user.id,
            MemoryFact.fact_status == "confirmed",
        )
    ).scalar_one()
    uncertain_facts = db.execute(
        select(func.count()).select_from(MemoryFact).where(
            MemoryFact.user_id == current_user.id,
            or_(MemoryFact.fact_status.in_(["inferred", "negated", "outdated"]), MemoryFact.confidence_score < 0.55),
        )
    ).scalar_one()
    outdated_facts = db.execute(
        select(func.count()).select_from(MemoryFact).where(
            MemoryFact.user_id == current_user.id,
            MemoryFact.fact_status == "outdated",
        )
    ).scalar_one()
    contradiction_facts = db.execute(
        select(func.count()).select_from(MemoryFact).where(
            MemoryFact.user_id == current_user.id,
            MemoryFact.fact_status.in_(["negated", "outdated"]),
        )
    ).scalar_one()

    stale_ratio = (float(outdated_facts) / float(total_facts)) if total_facts else 0.0
    contradiction_rate = (float(contradiction_facts) / float(total_facts)) if total_facts else 0.0
    return MemoryMetricsResponse(
        total_facts=total_facts,
        confirmed_facts=confirmed_facts,
        uncertain_facts=uncertain_facts,
        stale_fact_ratio=round(stale_ratio, 4),
        contradiction_rate=round(contradiction_rate, 4),
    )


@app.post("/api/knowledge/documents", response_model=KnowledgeDocumentItem)
async def ingest_knowledge_document(
    request: KnowledgeDocumentIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await upsert_document_with_chunks(
        db_session=db,
        user_id=current_user.id,
        title=request.title,
        content=request.content,
        source_type=request.source_type,
        source_ref=request.source_ref,
        domain=request.domain,
        product=request.product,
        language=request.language,
        version_tag=request.version_tag,
        tags=request.tags or {},
    )
    chunk_count = db.execute(
        select(func.count()).select_from(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
    ).scalar_one()
    return KnowledgeDocumentItem(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        source_ref=doc.source_ref,
        domain=doc.domain,
        product=doc.product,
        language=doc.language,
        version_tag=doc.version_tag,
        summary=doc.summary,
        chunk_count=int(chunk_count),
        updated_at=doc.updated_at,
    )


@app.post("/api/knowledge/documents/upload", response_model=KnowledgeDocumentItem)
async def upload_knowledge_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    domain: Optional[str] = Form(None),
    product: Optional[str] = Form(None),
    language: Optional[str] = Form("tr"),
    version_tag: Optional[str] = Form(None),
    source_ref: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Dosya boş olamaz.")

    extracted = _extract_text_from_uploaded_file(file.filename or "document", payload)
    if len(extracted.strip()) < 40:
        raise HTTPException(status_code=400, detail="Dosya içeriği indeksleme için en az 40 karakter olmalı.")

    inferred_title = (title or "").strip() or os.path.splitext(file.filename or "Untitled")[0]
    doc = await upsert_document_with_chunks(
        db_session=db,
        user_id=current_user.id,
        title=inferred_title,
        content=extracted,
        source_type="file",
        source_ref=(source_ref or "").strip() or file.filename,
        domain=(domain or "").strip() or "product",
        product=(product or "").strip() or None,
        language=(language or "tr").strip() or "tr",
        version_tag=(version_tag or "").strip() or None,
        tags={},
    )
    chunk_count = db.execute(
        select(func.count()).select_from(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
    ).scalar_one()
    return KnowledgeDocumentItem(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        source_ref=doc.source_ref,
        domain=doc.domain,
        product=doc.product,
        language=doc.language,
        version_tag=doc.version_tag,
        summary=doc.summary,
        chunk_count=int(chunk_count),
        updated_at=doc.updated_at,
    )


@app.get("/api/knowledge/documents", response_model=List[KnowledgeDocumentItem])
async def get_knowledge_documents(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = list_documents(db_session=db, user_id=current_user.id, limit=limit)
    doc_ids = [d.id for d in docs]
    counts: Dict[uuid.UUID, int] = {}
    if doc_ids:
        rows = db.execute(
            select(KnowledgeChunk.document_id, func.count().label("chunk_count"))
            .where(KnowledgeChunk.document_id.in_(doc_ids))
            .group_by(KnowledgeChunk.document_id)
        ).all()
        counts = {row.document_id: int(row.chunk_count) for row in rows}

    return [
        KnowledgeDocumentItem(
            id=doc.id,
            title=doc.title,
            source_type=doc.source_type,
            source_ref=doc.source_ref,
            domain=doc.domain,
            product=doc.product,
            language=doc.language,
            version_tag=doc.version_tag,
            summary=doc.summary,
            chunk_count=counts.get(doc.id, 0),
            updated_at=doc.updated_at,
        )
        for doc in docs
    ]


@app.delete("/api/knowledge/documents/{document_id}")
async def remove_knowledge_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = delete_document(db_session=db, user_id=current_user.id, document_id=document_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Knowledge document deleted"}


@app.post("/api/chat/attachments/extract", response_model=ChatAttachmentExtractResponse)
async def extract_chat_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    max_bytes = 5 * 1024 * 1024
    payload = await file.read()
    if len(payload) > max_bytes:
        raise HTTPException(status_code=400, detail="Dosya boyutu en fazla 5MB olabilir.")

    ext = (file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "").lower()
    supported_extensions = {
        "txt", "md", "markdown", "csv", "json", "log", "pdf", "html", "xml",
        "yaml", "yml", "ini", "cfg", "sql", "py", "js", "ts", "tsx", "jsx",
        "java", "go", "rs", "rb", "php", "c", "h", "cpp", "hpp", "sh",
    }
    if ext and ext not in supported_extensions:
        raise HTTPException(status_code=400, detail=f"Desteklenmeyen dosya türü: .{ext}")

    extracted = _extract_text_from_uploaded_file(file.filename or "attachment", payload)
    if len(extracted) < 5:
        raise HTTPException(status_code=400, detail="Dosyadan anlamlı metin çıkarılamadı.")

    return ChatAttachmentExtractResponse(
        filename=file.filename or "attachment",
        mime_type=file.content_type or "application/octet-stream",
        content=extracted[:12000],
        char_count=len(extracted[:12000]),
    )

@app.post("/api/auth/register")
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password)
    )
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()  # username field in form used for email
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        # Override request.user_id with authenticated user's ID for security
        user_id = current_user.id
        effective_message = _compose_message_with_attachments(request.message, request.attachments)
        conversation = _resolve_conversation(db, user_id, request.conversation_id, request.message)
        
        # Step 0: Cleanup stale cache in background
        background_tasks.add_task(delete_stale_cache, db)

        # Step 1: Analyze intent
        intent_response, router_model = await analyze_user_input(effective_message)
        print(f"DEBUG: Intent detected: {intent_response.intent} with reasoning: {intent_response.reasoning}")
        
        # Default model used is the router model unless overridden by agent
        final_model = router_model

        # Step 2: Route based on intent
        if intent_response.intent == IntentType.LOG_ENTITY:
            # Dual-Track: Run memory extraction in background and return immediately
            background_tasks.add_task(background_memory_extraction, user_id, effective_message, conversation.id)
            
            # Flush relevant cache because system knowledge changed (Smart clearing)
            await clear_user_cache(user_id, db_session=db, hint=effective_message)
            
            # Default acknowledgment if LLM fails to provide one
            ack = intent_response.suggested_acknowledgment or "Anladım, bu bilgiyi hafızama not ediyorum."
            
            # Passive observation in parallel to extraction
            background_tasks.add_task(background_passive_observation, user_id, effective_message, ack, conversation.id)
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                effective_message,
                ack,
                intent_response.intent.value,
                final_model,
            )
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=ack,
                model_used=final_model,
                conversation_id=conversation.id,
            )
            
        elif intent_response.intent == IntentType.QUERY_KNOWLEDGE:
            # 1. Semantic Cache Check (Mandatory Read Bypass inside check_cache)
            cached_response = await check_cache(user_id, effective_message, db_session=db)
            if cached_response:
                # IMPORTANT: Even on cache hit, trigger observation so system learns from context!
                background_tasks.add_task(background_passive_observation, user_id, effective_message, cached_response, conversation.id)
                _store_chat_history_now(
                    db,
                    user_id,
                    conversation.id,
                    effective_message,
                    cached_response,
                    intent_response.intent.value,
                    "pgvector-cache",
                )
                
                return ChatResponse(
                    intent=intent_response.intent.value,
                    message=cached_response,
                    model_used="pgvector-cache",
                    knowledge_sources=[],
                    conversation_id=conversation.id,
                )
            
            # 2. Dynamic Check for Web Search
            web_context = None
            status = await check_dynamic_status(effective_message)
            if status == "dinamik":
                print(f"🌐 [API] Dynamic query detected, initiating web search...")
                web_context = await search_the_web(effective_message, metadata=request.metadata)
 
            # 3. RAG flow if no cache
            print(f"DEBUG: Entering RAG flow for query knowledge")
            # Extract situational metadata if available
            meta_str = ""
            if request.metadata:
                m = request.metadata
                loc = m.get("location", {}) or {}
                city = loc.get("city", "Bilinmiyor")
                meta_str = f"\n[SİSTEM BAĞLAMI]: Konum: {city}, Saat: {m.get('time')}, Gün: {m.get('day')}"
            
            knowledge_result = await retrieve_knowledge_context(
                db_session=db,
                user_id=user_id,
                query=effective_message,
                metadata=request.metadata or {},
                top_k=8,
            )
            knowledge_context = knowledge_result.get("context", "")
            source_titles = [s.get("title") for s in knowledge_result.get("sources", []) if s.get("title")]
            if source_titles:
                unique_titles = list(dict.fromkeys(source_titles))[:5]
                meta_str += f"\n[KNOWLEDGE-ROUTING]: domain={knowledge_result.get('routing', {}).get('domain')} | kaynaklar={', '.join(unique_titles)}"
            if knowledge_result.get("needs_user_confirmation"):
                confirmation_msg = knowledge_result.get("confirmation_prompt") or "Bağlamı kullanmamı ister misin?"
                _store_chat_history_now(
                    db,
                    user_id,
                    conversation.id,
                    effective_message,
                    confirmation_msg,
                    intent_response.intent.value,
                    "knowledge-confirmation-gate",
                )
                return ChatResponse(
                    intent=intent_response.intent.value,
                    message=confirmation_msg,
                    model_used="knowledge-confirmation-gate",
                    knowledge_sources=knowledge_result.get("sources", []),
                    conversation_id=conversation.id,
                )

            answer, final_model = await answer_query(
                user_id,
                effective_message,
                db_session=db,
                web_context=web_context,
                metadata_context=meta_str,
                knowledge_context=knowledge_context,
                knowledge_sources=knowledge_result.get("sources", []),
            )
            
            # 4. Save to cache (Mandatory Write Bypass inside save_to_cache)
            await save_to_cache(user_id, effective_message, answer, db_session=db)
            
            # 5. Passive Observation
            background_tasks.add_task(background_passive_observation, user_id, effective_message, answer, conversation.id)
            effective_model = f"{final_model} + web-search" if web_context else final_model
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                effective_message,
                answer,
                intent_response.intent.value,
                effective_model,
            )
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=answer,
                model_used=effective_model,
                knowledge_sources=knowledge_result.get("sources", []),
                conversation_id=conversation.id,
            )
            
        elif intent_response.intent == IntentType.EXECUTE_TOOL:
            # External Tool flow: Select and run appropriate tool
            print(f"DEBUG: Entering EXECUTE_TOOL flow")
            recent_messages = _get_recent_conversation_messages(
                db=db,
                user_id=user_id,
                conversation_id=conversation.id,
                limit=8,
            )
            result, final_model, tool_sources = await execute_tool_for_user(
                user_id,
                effective_message,
                db_session=db,
                metadata=request.metadata or {},
                recent_messages=recent_messages,
            )
            print(f"DEBUG: Tool execution result: {result}")
            
            # Dual-Track: Even after tool execution, extract memory in background
            background_tasks.add_task(background_memory_extraction, user_id, effective_message, conversation.id)
            background_tasks.add_task(background_passive_observation, user_id, effective_message, result, conversation.id)
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                effective_message,
                result,
                intent_response.intent.value,
                final_model,
            )
            
            # Flush relevant cache because system state changed (Smart clearing)
            await clear_user_cache(user_id, db_session=db, hint=effective_message)
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=result,
                model_used=final_model,
                knowledge_sources=tool_sources,
                conversation_id=conversation.id,
            )
            
        else: # GENERAL_CHAT
            ack = intent_response.suggested_acknowledgment or "Merhaba! Size nasıl yardımcı olabilirim?"
            background_tasks.add_task(background_passive_observation, user_id, effective_message, ack, conversation.id)
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                effective_message,
                ack,
                intent_response.intent.value,
                final_model,
            )
            return ChatResponse(
                intent=intent_response.intent.value,
                message=ack,
                model_used=final_model,
                conversation_id=conversation.id,
            )
            
    except OpenAIAuthenticationError:
        print("OpenAI authentication failed in chat_endpoint. Check OPENAI_API_KEY configuration.")
        raise HTTPException(
            status_code=503,
            detail="AI servisi kimlik doğrulama hatası: OPENAI_API_KEY test ortamında geçersiz veya eksik.",
        )
    except ValueError as e:
        if "OPENAI_API_KEY" in str(e):
            raise HTTPException(
                status_code=503,
                detail="AI servisi yapılandırma hatası: OPENAI_API_KEY test ortamında ayarlanmamış.",
            )
        raise
    except Exception as e:
        print(f"Error in chat_endpoint: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
