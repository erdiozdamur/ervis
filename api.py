import os
import uuid
import traceback
from typing import Optional, Dict, Any

from dotenv import load_dotenv
# Load environment variables before other imports.
# In Docker/Production, we rely on system environment variables.
if os.path.exists(".env"):
    load_dotenv()

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
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
from models import User, Base

# Database Setup
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://ervis:ervis_password@localhost:5432/ervis_core"
)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Auto-create tables on startup (safe for production - only creates if not exists)
def _init_database():
    import time
    max_retries = 5
    retry_delay = 5
    for attempt in range(max_retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
            Base.metadata.create_all(bind=engine)
            print("✅ Database schema verified/created successfully.")
            return
        except Exception as e:
            print(f"⚠️ Database init attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                print(f"🔄 Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print("❌ Max retries reached. Database initialization failed.")

_init_database()

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

class ChatResponse(BaseModel):
    intent: str
    message: str
    model_used: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None

class UserRegister(BaseModel):
    username: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: uuid.UUID
    username: str

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
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=ack,
                model_used=final_model
            )
            
        elif intent_response.intent == IntentType.QUERY_KNOWLEDGE:
            # 1. Semantic Cache Check (Mandatory Read Bypass inside check_cache)
            cached_response = await check_cache(user_id, request.message, db_session=db)
            if cached_response:
                # IMPORTANT: Even on cache hit, trigger observation so system learns from context!
                background_tasks.add_task(background_passive_observation, user_id, request.message, cached_response)
                
                return ChatResponse(
                    intent=intent_response.intent.value,
                    message=cached_response,
                    model_used="pgvector-cache"
                )
            
            # 2. Dynamic Check for Web Search
            web_context = None
            status = await check_dynamic_status(request.message)
            if status == "dinamik":
                print(f"🌐 [API] Dynamic query detected, initiating web search...")
                web_context = await search_the_web(request.message)
 
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
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=answer,
                model_used=f"{final_model} + web-search" if web_context else final_model
            )
            
        elif intent_response.intent == IntentType.EXECUTE_TOOL:
            # External Tool flow: Select and run appropriate tool
            print(f"DEBUG: Entering EXECUTE_TOOL flow")
            result, final_model = await execute_tool_for_user(user_id, request.message, db_session=db)
            print(f"DEBUG: Tool execution result: {result}")
            
            # Dual-Track: Even after tool execution, extract memory in background
            background_tasks.add_task(background_memory_extraction, user_id, request.message)
            background_tasks.add_task(background_passive_observation, user_id, request.message, result)
            
            # Flush relevant cache because system state changed (Smart clearing)
            await clear_user_cache(user_id, db_session=db, hint=request.message)
            
            return ChatResponse(
                intent=intent_response.intent.value,
                message=result,
                model_used=final_model
            )
            
        else: # GENERAL_CHAT
            ack = intent_response.suggested_acknowledgment or "Merhaba! Size nasıl yardımcı olabilirim?"
            background_tasks.add_task(background_passive_observation, user_id, request.message, ack)
            return ChatResponse(
                intent=intent_response.intent.value,
                message=ack,
                model_used=final_model
            )
            
    except Exception as e:
        print(f"Error in chat_endpoint: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
