import os
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

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text, select, delete, func
from sqlalchemy.orm import sessionmaker, Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from services.llm_router import analyze_user_input, IntentType
from services.memory_agent import extract_knowledge, store_knowledge
from services.retrieval_agent import answer_query
from services.tool_agent import execute_tool_for_user
from services.cache_service import check_cache, save_to_cache, clear_user_cache, delete_stale_cache, check_dynamic_status
from services.web_search_agent import search_the_web
from services.auth_service import verify_password, get_password_hash, create_access_token, decode_access_token
from services.memory_observer import passive_memory_observation
from models import User, Base, ChatMessage, Conversation

# Database Setup
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required.")
engine = create_engine(DATABASE_URL)
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
async def background_memory_extraction(user_id: uuid.UUID, message: str):
    """
    Handles memory extraction and storage in the background with a fresh DB session.
    """
    db = SessionLocal()
    try:
        # 1. Extract knowledge graph
        extraction, model_name = await extract_knowledge(message)
        # 2. Store in DB with isolation
        await store_knowledge(user_id=user_id, extraction=extraction, db_session=db)
        print(f"Background memory extraction completed for user {user_id} using {model_name}")
    except Exception as e:
        print(f"Background memory error: {str(e)}")
    finally:
        db.close()

async def background_passive_observation(user_id: uuid.UUID, message: str, response: str):
    """
    Handles passive memory observation in the background.
    """
    db = SessionLocal()
    try:
        await passive_memory_observation(user_id, message, response, db)
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

class ChatResponse(BaseModel):
    intent: str
    message: str
    model_used: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    conversation_id: Optional[uuid.UUID] = None


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


_init_database()


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
        conversation = _resolve_conversation(db, user_id, request.conversation_id, request.message)
        
        # Step 0: Cleanup stale cache in background
        background_tasks.add_task(delete_stale_cache, db)

        # Step 1: Analyze intent
        intent_response, router_model = await analyze_user_input(request.message)
        print(f"DEBUG: Intent detected: {intent_response.intent} with reasoning: {intent_response.reasoning}")
        
        # Default model used is the router model unless overridden by agent
        final_model = router_model

        # Step 2: Route based on intent
        if intent_response.intent == IntentType.LOG_ENTITY:
            # Dual-Track: Run memory extraction in background and return immediately
            background_tasks.add_task(background_memory_extraction, user_id, request.message)
            
            # Flush relevant cache because system knowledge changed (Smart clearing)
            await clear_user_cache(user_id, db_session=db, hint=request.message)
            
            # Default acknowledgment if LLM fails to provide one
            ack = intent_response.suggested_acknowledgment or "Anladım, bu bilgiyi hafızama not ediyorum."
            
            # Passive observation in parallel to extraction
            background_tasks.add_task(background_passive_observation, user_id, request.message, ack)
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                request.message,
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
            cached_response = await check_cache(user_id, request.message, db_session=db)
            if cached_response:
                # IMPORTANT: Even on cache hit, trigger observation so system learns from context!
                background_tasks.add_task(background_passive_observation, user_id, request.message, cached_response)
                _store_chat_history_now(
                    db,
                    user_id,
                    conversation.id,
                    request.message,
                    cached_response,
                    intent_response.intent.value,
                    "pgvector-cache",
                )
                
                return ChatResponse(
                    intent=intent_response.intent.value,
                    message=cached_response,
                    model_used="pgvector-cache",
                    conversation_id=conversation.id,
                )
            
            # 2. Dynamic Check for Web Search
            web_context = None
            status = await check_dynamic_status(request.message)
            if status == "dinamik":
                print(f"🌐 [API] Dynamic query detected, initiating web search...")
                web_context = await search_the_web(request.message, metadata=request.metadata)
 
            # 3. RAG flow if no cache
            print(f"DEBUG: Entering RAG flow for query knowledge")
            # Extract situational metadata if available
            meta_str = ""
            if request.metadata:
                m = request.metadata
                loc = m.get("location", {}) or {}
                city = loc.get("city", "Bilinmiyor")
                meta_str = f"\n[SİSTEM BAĞLAMI]: Konum: {city}, Saat: {m.get('time')}, Gün: {m.get('day')}"
            
            answer, final_model = await answer_query(user_id, request.message, db_session=db, web_context=web_context, metadata_context=meta_str)
            
            # 4. Save to cache (Mandatory Write Bypass inside save_to_cache)
            await save_to_cache(user_id, request.message, answer, db_session=db)
            
            # 5. Passive Observation
            background_tasks.add_task(background_passive_observation, user_id, request.message, answer)
            effective_model = f"{final_model} + web-search" if web_context else final_model
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                request.message,
                answer,
                intent_response.intent.value,
                effective_model,
            )
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=answer,
                model_used=effective_model,
                conversation_id=conversation.id,
            )
            
        elif intent_response.intent == IntentType.EXECUTE_TOOL:
            # External Tool flow: Select and run appropriate tool
            print(f"DEBUG: Entering EXECUTE_TOOL flow")
            result, final_model = await execute_tool_for_user(user_id, request.message, db_session=db)
            print(f"DEBUG: Tool execution result: {result}")
            
            # Dual-Track: Even after tool execution, extract memory in background
            background_tasks.add_task(background_memory_extraction, user_id, request.message)
            background_tasks.add_task(background_passive_observation, user_id, request.message, result)
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                request.message,
                result,
                intent_response.intent.value,
                final_model,
            )
            
            # Flush relevant cache because system state changed (Smart clearing)
            await clear_user_cache(user_id, db_session=db, hint=request.message)
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=result,
                model_used=final_model,
                conversation_id=conversation.id,
            )
            
        else: # GENERAL_CHAT
            ack = intent_response.suggested_acknowledgment or "Merhaba! Size nasıl yardımcı olabilirim?"
            background_tasks.add_task(background_passive_observation, user_id, request.message, ack)
            _store_chat_history_now(
                db,
                user_id,
                conversation.id,
                request.message,
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
            
    except Exception as e:
        print(f"Error in chat_endpoint: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
