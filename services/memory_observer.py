import os
import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from openai import AsyncOpenAI
from models import Entity, Relation, User
from sqlalchemy import select

_client: Optional[AsyncOpenAI] = None

def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

async def passive_memory_observation(user_id: uuid.UUID, query: str, response: str, db_session: Session):
    """
    Analyzes a chat interaction to extract implicit interests and preferences.
    Updates the Knowledge Graph with [User] -> (HAS_INTEREST) -> [Topic] relations.
    """
    try:
        client = get_openai_client()
        
        system_prompt = """Sen Ervis'in Pasif Gözlemci Ajanı'sın. Görevin, kullanıcı ve asistan arasındaki yazışmayı analiz ederek kullanıcının uzun vadeli İLGİ ALANLARINI, TERCİHLERİNİ, ALIŞKANLIKLARINI ve KİMLİK/ROL (Meslek, Uzmanlık, Unvan) bilgilerini tespit etmektir.
        
        KURALLAR:
        1. Belirgin ilgi alanlarını çıkar (Örn: 'Futbol', 'Yazılım').
        2. KİMLİK VE ROL bilgilerini titizlikle ayıkla (Örn: Kullanıcı 'Ben bir Product Owner'ım' diyorsa -> 'Product Owner').
        3. Çıkardığın her bilgiyi kısa anahtar kelimeler olarak belirle.
        4. Eğer yeni bir bilgi yoksa 'NONE' yaz.
        
        ÇIKTI FORMATI: 
        Sadece virgülle ayrılmış anahtar kelimeler (Örn: Product Owner, Futbol, Teknoloji). Hiçbir şey bulamadıysan 'NONE' yaz.
        """
        
        llm_response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Kullanıcı: {query}\nAsistan: {response}"}
            ],
            temperature=0.0
        )
        
        content = llm_response.choices[0].message.content.strip()
        if content == "NONE" or not content:
            return

        interests = [i.strip() for i in content.split(",") if i.strip()]
        
        # Get User object
        user = db_session.get(User, user_id)
        if not user: return

        for topic in interests:
            # Determining the most appropriate entity type
            # If it's a known role or sounds like a profession, we'll mark it as 'Meslek'
            is_role = any(kw in topic.lower() for kw in ["owner", "müdür", "manager", "engineer", "doktor", "yazılımcı", "tasarımcı", "analist", "başkan", "öğretmen"])
            e_type = "Meslek" if is_role else "İlgi Alanı"

            # 1. Ensure the Entity exists
            entity_stmt = select(Entity).where(Entity.user_id == user_id, Entity.name == topic, or_(Entity.entity_type == "İlgi Alanı", Entity.entity_type == "Meslek"))
            topic_entity = db_session.execute(entity_stmt).scalars().first()
            
            if not topic_entity:
                topic_entity = Entity(
                    user_id=user_id,
                    name=topic,
                    entity_type=e_type,
                    attributes={"source": "passive_observation"}
                )
                db_session.add(topic_entity)
                db_session.flush() # Get ID
            
            # 2. Check if relation exists to avoid duplicates
            # Since 'User' is not in the Entity table (usually), we might need a specific 'User' entity entry 
            # Or we can link the Topic entity to a special 'Profile' entity.
            # For simplicity, let's create a 'Profil' entity for every user if not exists.
            
            profile_stmt = select(Entity).where(Entity.user_id == user_id, Entity.name == "Kullanıcı Profili", Entity.entity_type == "Profil")
            profile_entity = db_session.execute(profile_stmt).scalars().first()
            
            if not profile_entity:
                profile_entity = Entity(
                    user_id=user_id,
                    name="Kullanıcı Profili",
                    entity_type="Profil",
                    attributes={"username": user.username}
                )
                db_session.add(profile_entity)
                db_session.flush()

            # Link Profile -> (HAS_INTEREST) -> Topic
            rel_stmt = select(Relation).where(
                Relation.source_entity_id == profile_entity.id,
                Relation.target_entity_id == topic_entity.id,
                Relation.relation_type == "İLGİ_DUYUYOR"
            )
            existing_rel = db_session.execute(rel_stmt).scalars().first()
            
            if not existing_rel:
                new_rel = Relation(
                    source_entity_id=profile_entity.id,
                    target_entity_id=topic_entity.id,
                    relation_type="İLGİ_DUYUYOR",
                    attributes={"confidence": "high", "detected_from": query[:50]}
                )
                db_session.add(new_rel)
        
        db_session.commit()
        print(f"🧠 [OBSERVER] Inferred interests: {interests} for user {user.username}")
        
    except Exception as e:
        db_session.rollback()
        print(f"❌ [OBSERVER] Error: {str(e)}")
