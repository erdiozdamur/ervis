import os
import uuid
from typing import Optional, List
from sqlalchemy.orm import Session
from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from models import Entity, Relation, User, MemoryFact
from sqlalchemy import select, or_

_client: Optional[AsyncOpenAI] = None
TOPIC_ALIAS_MAP = {
    "po": "Product Owner",
    "pm": "Product Manager",
}

def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


def _normalize_topic(topic: str) -> str:
    normalized = " ".join((topic or "").strip().split())
    alias_key = normalized.lower()
    return TOPIC_ALIAS_MAP.get(alias_key, normalized)

async def passive_memory_observation(
    user_id: uuid.UUID,
    query: str,
    response: str,
    db_session: Session,
    source_message_id: Optional[uuid.UUID] = None,
):
    """
    Analyzes a chat interaction to extract implicit interests and preferences.
    Updates the Knowledge Graph with [User] -> (HAS_INTEREST) -> [Topic] relations.
    """
    try:
        client = get_openai_client()
        
        class ObservedFact(BaseModel):
            topic: str = Field(description="Short fact/topic phrase")
            fact_type: str = Field(description="interest|role|habit|preference")
            confidence_score: float = Field(default=0.7, ge=0.0, le=1.0)
            evidence_text: str = Field(default="", description="Short evidence quoted from user content")
            fact_status: str = Field(default="inferred", description="confirmed|inferred|negated|outdated")

        class ObservationPayload(BaseModel):
            facts: List[ObservedFact]

        system_prompt = """Sen Ervis'in Pasif Gözlemci Ajanı'sın. Görevin, kullanıcı ve asistan arasındaki yazışmayı analiz ederek kullanıcının uzun vadeli İLGİ ALANLARINI, TERCİHLERİNİ, ALIŞKANLIKLARINI ve KİMLİK/ROL (Meslek, Uzmanlık, Unvan) bilgilerini tespit etmektir.
        
        KURALLAR:
        1. Belirgin ilgi alanlarını çıkar (Örn: 'Futbol', 'Yazılım').
        2. KİMLİK VE ROL bilgilerini titizlikle ayıkla (Örn: Kullanıcı 'Ben bir Product Owner'ım' diyorsa -> 'Product Owner').
        3. Çıkardığın her bilgiyi kısa anahtar kelimeler olarak belirle.
        4. Eğer yeni bir bilgi yoksa 'NONE' yaz.
        
        ÇIKTI FORMATI:
        JSON formatında { "facts": [{ "topic": "...", "fact_type": "...", "confidence_score": 0-1, "evidence_text": "...", "fact_status": "inferred" }] } döndür.
        Bilgi yoksa {"facts": []} döndür.
        """

        llm_response = await client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Kullanıcı: {query}\nAsistan: {response}"}
            ],
            response_format=ObservationPayload,
            temperature=0.0
        )

        payload = llm_response.choices[0].message.parsed
        if not payload or not payload.facts:
            return

        # Get User object
        user = db_session.get(User, user_id)
        if not user: return

        for item in payload.facts:
            topic = _normalize_topic(item.topic)
            if not topic:
                continue
            # Determining the most appropriate entity type
            # If it's a known role or sounds like a profession, we'll mark it as 'Meslek'
            is_role = item.fact_type == "role" or any(kw in topic.lower() for kw in ["owner", "müdür", "manager", "engineer", "doktor", "yazılımcı", "tasarımcı", "analist", "başkan", "öğretmen"])
            e_type = "Meslek" if is_role else "İlgi Alanı"

            # 1. Ensure the Entity exists
            entity_stmt = select(Entity).where(Entity.user_id == user_id, Entity.name == topic, or_(Entity.entity_type == "İlgi Alanı", Entity.entity_type == "Meslek"))
            topic_entity = db_session.execute(entity_stmt).scalars().first()
            
            if not topic_entity:
                topic_entity = Entity(
                    user_id=user_id,
                    name=topic,
                    entity_type=e_type,
                    attributes={"source": "passive_observation", "fact_type": item.fact_type}
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
                    attributes={
                        "confidence_score": max(0.0, min(1.0, float(item.confidence_score))),
                        "detected_from": query[:200],
                        "fact_type": item.fact_type,
                    }
                )
                db_session.add(new_rel)
                db_session.flush()
                rel_obj = new_rel
            else:
                rel_obj = existing_rel

            db_session.add(
                MemoryFact(
                    user_id=user_id,
                    entity_id=topic_entity.id,
                    relation_id=rel_obj.id if rel_obj else None,
                    source_message_id=source_message_id,
                    fact_text=f"{e_type}: {topic}",
                    fact_status=item.fact_status if item.fact_status in {"confirmed", "inferred", "negated", "outdated"} else "inferred",
                    confidence_score=max(0.0, min(1.0, float(item.confidence_score))),
                    evidence_text=(item.evidence_text or query)[:500],
                )
            )
        
        db_session.commit()
        print(f"🧠 [OBSERVER] Inferred {len(payload.facts)} facts for user {user.username}")
        
    except Exception as e:
        db_session.rollback()
        print(f"❌ [OBSERVER] Error: {str(e)}")
