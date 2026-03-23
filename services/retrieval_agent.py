import os
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from openai import AsyncOpenAI
from models import Entity, Relation

# load_dotenv is handled globally in api.py
# Reuse the lazy client initialization pattern from other services
_client: Optional[AsyncOpenAI] = None

def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing. Please set it in the .env file.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

async def retrieve_context(user_id: uuid.UUID, query: str, db_session: Session) -> str:
    """
    Search for relevant entities and relations in the database and format them as context.
    Uses a hybrid matching approach and fallbacks to the most recent records for better reasoning.
    """
    # 1. Fetch all user entities to perform logical filtering
    all_user_entities = db_session.execute(
        select(Entity).where(Entity.user_id == user_id).order_by(Entity.created_at.desc())
    ).scalars().all()
    
    query_lower = query.lower()
    words = [w.strip().lower() for w in query.split() if len(w) > 2]
    
    # Keyword-based matching
    matched_entities = []
    for e in all_user_entities:
        name_lower = e.name.lower()
        if name_lower in query_lower or any(word in name_lower for word in words):
            matched_entities.append(e)

    # Fallback: If no keyword matches, take the most recent 10 entities
    if not matched_entities and all_user_entities:
        matched_entities = all_user_entities[:10]
    
    entity_ids = [e.id for e in matched_entities]
    
    context_lines = []
    for e in matched_entities:
        attr_str = ", ".join([f"{k}: {v}" for k, v in (e.attributes or {}).items()])
        context_lines.append(f"[Varlık: {e.name}] (Tip: {e.entity_type}) Özellikler: {{{attr_str}}}")

    # 2. Query relations related to these entities OR the 20 most recent relations overall
    if entity_ids:
        rel_stmt = select(Relation).where(
            or_(
                Relation.source_entity_id.in_(entity_ids),
                Relation.target_entity_id.in_(entity_ids)
            )
        ).order_by(Relation.valid_from.desc())
    else:
        # Absolute fallback: Get the last 20 relations for the user regardless of keywords
        rel_stmt = select(Relation).join(Entity, Relation.source_entity_id == Entity.id).where(
            Entity.user_id == user_id
        ).order_by(Relation.valid_from.desc()).limit(20)

    relations = db_session.execute(rel_stmt).scalars().all()
    
    # Load all entity names for formatting
    all_entity_ids_in_rels = set()
    for r in relations:
        all_entity_ids_in_rels.add(r.source_entity_id)
        all_entity_ids_in_rels.add(r.target_entity_id)
        
    entity_name_map = {}
    if all_entity_ids_in_rels:
        name_stmt = select(Entity.id, Entity.name).where(Entity.id.in_(list(all_entity_ids_in_rels)))
        result_names = db_session.execute(name_stmt).all()
        entity_name_map = {row.id: row.name for row in result_names}

    for r in relations:
        source_name = entity_name_map.get(r.source_entity_id, "Bilinmeyen")
        target_name = entity_name_map.get(r.target_entity_id, "Bilinmeyen")
        attr_str = ", ".join([f"{k}: {v}" for k, v in (r.attributes or {}).items()])
        context_lines.append(f"[İlişki: {source_name}] -> ({r.relation_type}) -> [{target_name}] Özellikler: {{{attr_str}}}")

    if not context_lines:
        print(f"DEBUG: Veritabanından hiçbir kayıt dönmedi! (User: {user_id})")
        return "Hiçbir kayıt bulunamadı."
        
    return "\n".join(context_lines)

async def answer_query(user_id: uuid.UUID, query: str, db_session: Session, web_context: Optional[str] = None) -> tuple[str, str]:
    """
    Retrieves context and uses LLM to generate a natural language answer.
    Includes optional web_context for dynamic queries.
    """
    context = await retrieve_context(user_id, query, db_session)
    
    client = get_openai_client()
    
    current_date = datetime.now().strftime("%d %B %Y %A")
    web_info = f"\n\n[GÜNCEL İNTERNET BİLGİSİ]:\n{web_context}" if web_context else ""
    
    system_prompt = f"""Sen Ervis'in akıllı asistanısın. 
BUGÜNÜN TARİHİ: {current_date}

Kullanıcının sorusuna cevap verirken sağlanan [SİSTEM HAFIZASI] ve özellikle [GÜNCEL İNTERNET BİLGİSİ] verilerini kullan.

### KESİN VERİ ÖNCELİĞİ (DATA OVER INTUITION):
1. İNTERNET BİLGİSİ ÜSTÜNLÜĞÜ: [GÜNCEL İNTERNET BİLGİSİ] sağlanmışsa, kendi eğitim verilerini (halüsinasyonlarını) tamamen DEVRE DIŞI BIRAK. Sadece bu güncel verilere dayanarak konuş.
2. TARİH HASSASİYETİ: Kullanıcının sorduğu tarihle ({current_date}) internetten gelen verideki tarihin eşleştiğinden emin ol. Eğer internetten gelen bilgiler eski bir tarihe aitse ve bugünü kapsamıyorsa, "Elimdeki güncel veriler [Tarih]'e ait, bugünkü durum henüz yansımamış" gibi dürüst bir cevap ver. Tahmin yürütme.
3. BAĞLAMSAL HİBRİT: Kullanıcının yerel hafızasıyla internet bilgisini birleştir.

Cevaplarını her zaman profesyonel, zeki ve Türkçe olarak ver.
"""
    
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"[SİSTEM HAFIZASI]:\n{context}{web_info}\n\n[KULLANICI SORUSU]:\n{query}"}
        ],
        temperature=0.0
    )
    
    return response.choices[0].message.content, response.model
