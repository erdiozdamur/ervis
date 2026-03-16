import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy import select, delete, func
from sqlalchemy.orm import Session
from openai import AsyncOpenAI
from dotenv import load_dotenv

from models import QueryCache

load_dotenv(override=True)
_client: Optional[AsyncOpenAI] = None

def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing. Please set it in the .env file.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

async def get_embedding(text: str) -> List[float]:
    client = get_openai_client()
    # Prepend hidden UTC timestamp for time-aware semantic matching
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    timestamped_text = f"[{now_utc}] {text}"
    
    response = await client.embeddings.create(
        input=timestamped_text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding

async def check_dynamic_status(query: str) -> str:
    """
    LLM as a Judge: Determines if the query is 'dinamik' or 'statik'.
    """
    try:
        client = get_openai_client()
        system_prompt = (
            "Sen Ervis'in Önbellek Hakemi'sin (Cache Judge). Aşağıdaki sorunun cevabı zamanla değişen dinamik bir bilgi mi "
            "(hava durumu, saat, güncel haber, borsa, anlık durum vb.) yoksa sabit/kişisel bir gerçeklik mi? "
            "Sadece 'dinamik' veya 'statik' cevabını ver."
        )
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            max_tokens=5,
            temperature=0.0
        )
        decision = response.choices[0].message.content.strip().lower()
        if "dinamik" in decision:
            return "dinamik"
        return "statik"
    except Exception as e:
        print(f"Cache judge error: {str(e)}")
        return "dinamik" # Default to dynamic on error for safety

async def check_cache(user_id: uuid.UUID, query: str, db_session: Session) -> Optional[str]:
    """
    Check for semantically similar queries in the cache within 12 hours.
    Bypasses if query is dynamic.
    """
    try:
        # Step 1: LLM Judge - Mandatory Read Bypass
        status = await check_dynamic_status(query)
        if status == "dinamik":
            print(f"⚖️ HAKEM KARARI: Dinamik - İşlem: Cache Pas Geçildi (Sorgu: {query[:30]}...)")
            return None
        
        print(f"⚖️ HAKEM KARARI: Statik - İşlem: Cache Araması Yapılıyor")

        # Step 2: Time Filter - Only consider records from last 30 days (1 month)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

        # Debug: Check row count for user within time window
        stmt = select(func.count()).select_from(QueryCache).where(
            QueryCache.user_id == user_id,
            QueryCache.created_at >= thirty_days_ago
        )
        kayit_sayisi = db_session.execute(stmt).scalar()
        print(f"📦 [CACHE DEBUG] 30 günlük geçerli kayıt sayısı: {kayit_sayisi}")

        if kayit_sayisi == 0:
            return None

        query_embedding = await get_embedding(query)
        
        # pgvector <=> operator returns cosine distance
        distance_expr = QueryCache.query_embedding.cosine_distance(query_embedding)
        
        # Query for matching record within time window
        stmt = select(QueryCache, distance_expr.label("distance")).where(
            QueryCache.user_id == user_id,
            QueryCache.created_at >= thirty_days_ago
        ).order_by("distance").limit(1)
        
        result_row = db_session.execute(stmt).one_or_none()
        
        if result_row:
            best_match, distance = result_row
            similarity_score = 1 - distance
            print(f"🔍 [CACHE DEBUG] Benzerlik skoru: {similarity_score:.4F}")
            
            if similarity_score >= 0.85:
                return best_match.llm_response
        
        return None
    except Exception as e:
        print(f"Cache check error: {str(e)}")
        return None

async def save_to_cache(user_id: uuid.UUID, query: str, response: str, db_session: Session):
    """
    Record a new query and response to the semantic cache if it's static.
    """
    try:
        # LLM Judge - Mandatory Write Bypass
        status = await check_dynamic_status(query)
        if status == "dinamik":
            print(f"⚖️ HAKEM KARARI: Dinamik - İşlem: Kayıt Engellendi (Sorgu: {query[:30]}...)")
            return

        print(f"⚖️ HAKEM KARARI: Statik - İşlem: Cache Kaydı Yapılıyor")
        query_embedding = await get_embedding(query)
        new_cache = QueryCache(
            user_id=user_id,
            query_text=query,
            query_embedding=query_embedding,
            llm_response=response
        )
        db_session.add(new_cache)
        db_session.commit()
        print(f"✅ [CACHE] Yeni kayıt eklendi: {query[:30]}...")
    except Exception as e:
        db_session.rollback()
        print(f"Cache save error: {str(e)}")

async def delete_stale_cache(db_session: Session):
    """
    Hard delete all cache records older than 12 hours.
    """
    try:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        stmt = delete(QueryCache).where(QueryCache.created_at < thirty_days_ago)
        result = db_session.execute(stmt)
        db_session.commit()
        if result.rowcount > 0:
            print(f"🗑️ [CACHE CLEANUP] {result.rowcount} eski kayıt (30 günden eski) kalıcı olarak silindi.")
    except Exception as e:
        db_session.rollback()
        print(f"Cache cleanup error: {str(e)}")

async def clear_user_cache(user_id: uuid.UUID, db_session: Session, hint: str = None):
    """
    Clears user cache. If hint is provided, it clears semantically related items.
    Otherwise, clears all (full flush).
    """
    try:
        if hint:
            print(f"🧹 [CACHE] Akıllı temizleme başlatıldı (İpucu: '{hint[:30]}...')")
            hint_embedding = await get_embedding(hint)
            
            # Using pgvector cosine distance: distance < (1 - threshold)
            # threshold=0.6 seems reasonable for semantic invalidation
            distance_expr = QueryCache.query_embedding.cosine_distance(hint_embedding)
            
            stmt = delete(QueryCache).where(
                QueryCache.user_id == user_id,
                distance_expr < 0.4 # Similarity >= 0.6
            )
            result = db_session.execute(stmt)
            db_session.commit()
            print(f"🧹 [CACHE] {result.rowcount} ilgili kayıt temizlendi.")
        else:
            stmt = delete(QueryCache).where(QueryCache.user_id == user_id)
            db_session.execute(stmt)
            db_session.commit()
            print(f"🧹 [CACHE] Önbellek tamamen temizlendi (User: {user_id})")
    except Exception as e:
        db_session.rollback()
        print(f"Cache clear error: {str(e)}")
