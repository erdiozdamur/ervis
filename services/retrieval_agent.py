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
    ALWAYS includes 'Kullanıcı Profili' and 'Rol/Meslek' information to ensure identity awareness.
    """
    # 1. Fetch Identity/Profile entities FIRST
    profile_stmt = select(Entity).where(
        Entity.user_id == user_id, 
        or_(Entity.entity_type == "Profil", Entity.entity_type == "Kullanıcı Profili", Entity.entity_type == "Meslek", Entity.entity_type == "Rol")
    )
    profile_entities = db_session.execute(profile_stmt).scalars().all()
    
    # 2. Fetch all other user entities for keyword matching
    all_user_entities = db_session.execute(
        select(Entity).where(Entity.user_id == user_id).order_by(Entity.created_at.desc())
    ).scalars().all()
    
    query_lower = query.lower()
    words = [w.strip().lower() for w in query.split() if len(w) > 2]
    
    # Keyword-based matching
    matched_entities = list(profile_entities) # Start with profile info
    seen_ids = {e.id for e in profile_entities}

    for e in all_user_entities:
        if e.id in seen_ids: continue
        name_lower = e.name.lower()
        if name_lower in query_lower or any(word in name_lower for word in words):
            matched_entities.append(e)
            seen_ids.add(e.id)

    # Fallback: If no keyword matches beyond profile, take the most recent 5 entities
    if len(matched_entities) == len(profile_entities) and all_user_entities:
        for e in all_user_entities[:5]:
            if e.id not in seen_ids:
                matched_entities.append(e)
                seen_ids.add(e.id)
    
    entity_ids = list(seen_ids)
    
    context_lines = []
    for e in matched_entities:
        attr_str = ", ".join([f"{k}: {v}" for k, v in (e.attributes or {}).items()])
        context_lines.append(f"[Varlık: {e.name}] (Tip: {e.entity_type}) Özellikler: {{{attr_str}}}")

    # 3. Query relations related to these entities
    if entity_ids:
        rel_stmt = select(Relation).where(
            or_(
                Relation.source_entity_id.in_(entity_ids),
                Relation.target_entity_id.in_(entity_ids)
            )
        ).order_by(Relation.valid_from.desc())
        
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
        return "Hiçbir kayıt bulunamadı."
        
    return "\n".join(context_lines)

async def answer_query(user_id: uuid.UUID, query: str, db_session: Session, web_context: Optional[str] = None, metadata_context: str = "") -> tuple[str, str]:
    """
    Retrieves context and uses LLM to generate a natural language answer.
    """
    context = await retrieve_context(user_id, query, db_session)
    
    client = get_openai_client()
    
    current_date = datetime.now().strftime("%d %B %Y %A")
    web_info = f"\n\n[GÜNCEL İNTERNET BİLGİSİ]:\n{web_context}" if web_context else ""
    meta_info = f"\n\n{metadata_context}" if metadata_context else ""
    
    system_prompt = f"""Sen Ervis'in akıllı asistanısın. 
BUGÜNÜN TARİHİ: {current_date}{meta_info}

Kullanıcının sorusuna cevap verirken sağlanan [SİSTEM HAFIZASI] verilerini kullan. 
ÖNEMLİ: [SİSTEM HAFIZASI] içinde kullanıcının 'Meslek', 'Profil' veya 'Rol' (örn: Product Owner) bilgisi varsa, cevaplarını mutlaka bu perspektifle ver. Bir uzmana yakışır, profesyonel ve bağlamsal bir dil kullan.

### BELİRSİZLİK VE EKSİK BİLGİ PROTOKOLÜ (INTELLIGENT AMBIGUITY):
1. EĞER BİLGİ EKSİKSE:
   - KESİNLİKLE rastgele bir varsayım yapma.
   - VARSA [SİSTEM HAFIZASI] verilerini kullanarak en olası tahmini yap ve bunu belirt ("Product Owner olduğun için şu metodun sana daha uygun olacağını düşünüyorum...").
   - HİÇBİR İPUCU YOKSA: Genel ve kapsayıcı bir "Temel Cevap" ver, ardından farklı seçenekler sun.
2. İNTERNET BİLGİSİ ÜSTÜNLÜĞÜ: [GÜNCEL İNTERNET BİLGİSİ] sağlanmışsa, sadece bu verilere dayan.
3. TARİH HASSASİYETİ: Özellikle 'bugün/yarın/dün' sorularında mutlak tarihleri kontrol et ve cevabında belirt.
4. KESİNLİK KORUMASI: [GÜNCEL İNTERNET BİLGİSİ] içinde ilgili maç/etkinlik için net tarih + kaynak yoksa kesin bir rakip/sonuç söyleme; "doğrulayamadım" diyerek kullanıcıdan yeniden doğrulama izni iste.
5. KATI KURAL: Eğer [GÜNCEL İNTERNET BİLGİSİ] içinde "[DOĞRULAMA BAŞARISIZ]" geçiyorsa, kesin bilgi verme. Rakip adı veya skor söyleme. Sadece doğrulanamadığını açıkla ve resmi kaynak öner.
6. ESPN FIKSTÜR MARKERLARI:
   - Eğer "[KAYNAK:ESPN-FIXTURE]" geçiyorsa, oradaki eşleşme/tarih bilgisi birincil doğrudur. Kısa ve net cevap ver.
   - Eğer "[KAYNAK:ESPN-FIXTURE-NO-MATCH]" ve "status=NO_MATCH_ON_TARGET_DATE" geçiyorsa, o tarihte maç olmadığını açıkça söyle. Varsa `next_match_date` ve `next_match` bilgisini ekle.
7. KAYNAK ŞEFFAFLIĞI: Dinamik cevap verirken en az bir kaynağı kısa şekilde an (site adı veya link).

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
