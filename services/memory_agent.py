import os
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session
from models import Entity, Relation, MemoryFact

# load_dotenv is handled globally in api.py

_client: Optional[AsyncOpenAI] = None
ENTITY_ALIAS_MAP = {
    "po": "Product Owner",
    "pm": "Product Manager",
    "yazilimci": "Yazılımcı",
    "software engineer": "Software Engineer",
}

def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            raise ValueError("OPENAI_API_KEY is missing. Please set it in the .env file.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

class Attribute(BaseModel):
    key: str = Field(description="The attribute key (e.g., 'model', 'color', 'status').")
    value: str = Field(description="The attribute value as a string.")

class ExtractedEntity(BaseModel):
    name: str = Field(description="Name of the entity, e.g., 'Kullanıcı', 'Salon', 'Hue Play Bar'")
    entity_type: str = Field(description="Type of the entity, e.g., 'Person', 'Vehicle', 'Device', 'Activity'")
    status: str = Field(description="Current status of the entity: 'owned' (already has it) or 'planned' (wants to buy/do it).")
    confidence_score: float = Field(default=0.7, ge=0.0, le=1.0, description="Confidence score between 0 and 1.")
    evidence_text: str = Field(default="", description="Short direct evidence from user message.")
    attributes: List[Attribute] = Field(description="List of key-value pairs for the entity attributes.")

class ExtractedRelation(BaseModel):
    source_entity_name: str = Field(description="Name of the source entity.")
    target_entity_name: str = Field(description="Name of the target entity.")
    relation_type: str = Field(description="Type of relation, e.g., 'OWNS', 'PERFORMED', 'PART_OF', 'LOCATED_IN'")
    confidence_score: float = Field(default=0.7, ge=0.0, le=1.0, description="Confidence score between 0 and 1.")
    evidence_text: str = Field(default="", description="Short direct evidence from user message.")
    attributes: List[Attribute] = Field(description="List of key-value pairs for the relation attributes.")

class KnowledgeExtraction(BaseModel):
    fact_status: str = Field(default="confirmed", description="Global status: confirmed|inferred|negated|outdated")
    entities: List[ExtractedEntity]
    relations: List[ExtractedRelation]


SYSTEM_PROMPT = """Sen bir bilgi grafiği çıkarım motorusun. Kullanıcının metninden ana varlıkları (Entities) ve aralarındaki ilişkileri (Relations) çıkar.

### KATEGORİZASYON VE ONTOLOJİ KURALLARI:
1. FİZİKSEL EŞYA (Physical Item): Araba, Gitar, Laptop gibi kalıcı nesneler. Bunlar ana düğümlerdir.
2. SARF MALZEMESİ / BAKIM (Maintenance/Consumable): Yağ, Filtre, Gitar Teli gibi tükenen veya değişen parçalar.
3. KİMLİK/ROL (Identity/Role): Meslek, Unvan, Uzmanlık (Örn: "Product Owner", "Doktor"). Bunları 'Meslek' veya 'Rol' tipinde kaydet.
4. DURUM / OLAY (State/Event): "Yağ değişimi", "Muayene tarihi" gibi zamanlı aksiyonlar.

### İLİŞKİ KURMA VE YAPISAL KURALLAR:
- CİHAZ-PARÇA İLİŞKİSİ: [Yağ] -> PART_OF -> [Passat].
- KİMLİK İLİŞKİSİ: [Kullanıcı] -> HAS_ROLE -> [Product Owner].
- DURUM VE NİYET AYRIMI: 
    - SAHİPLİK (OWNED): "aldım", "var", "sahibim", "ben bir ...'yım" -> status: 'owned', İlişki: 'OWNS' veya 'HAS_ROLE'.
    - İHTİYAÇ/PLAN (PLANNED): "almam lazım", "alacağım", "planlıyorum" -> status: 'planned', İlişki: 'WANTS' veya 'NEEDS'.

### ÖRNEKLER:
- "Ben bir Product Owner'ım" -> Varlık: Product Owner (entity_type: Role, status: owned), İlişki: Kullanıcı -> HAS_ROLE -> Product Owner.
- "Pena almam lazım" -> Varlık: Pena (entity_type: Consumable, status: planned), İlişki: Kullanıcı -> NEEDS -> Pena.

Lütfen sadece kullanıcıya ait ve kullanıcının bahsettiği asıl nesneleri varlık olarak kaydet. Özellikleri (attributes) çıkarırken anahtar ve değerleri net bir şekilde ayır.
Her varlık/ilişki için confidence_score ve evidence_text üret.
Genel fact_status alanını confirmed|inferred|negated|outdated olarak doldur.
"""

async def extract_knowledge(user_input: str) -> tuple[KnowledgeExtraction, str]:
    client = get_openai_client()
    response = await client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_input}
        ],
        response_format=KnowledgeExtraction,
        temperature=0.0
    )
    return response.choices[0].message.parsed, response.model


def _clamp_confidence(value: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.7


def _normalize_entity_name(raw_name: str) -> str:
    normalized = " ".join((raw_name or "").strip().split())
    alias_key = normalized.lower()
    if alias_key in ENTITY_ALIAS_MAP:
        return ENTITY_ALIAS_MAP[alias_key]
    return normalized


async def store_knowledge(
    user_id: uuid.UUID,
    extraction: KnowledgeExtraction,
    db_session: Session,
    source_message_id: Optional[uuid.UUID] = None,
):
    entity_id_map = {}

    for ext_entity in extraction.entities:
        ext_entity.name = _normalize_entity_name(ext_entity.name)
        # Convert List[Attribute] to Dict[str, Any] and add status
        attr_dict = {attr.key: attr.value for attr in ext_entity.attributes}
        attr_dict["status"] = ext_entity.status
        
        existing_entity = db_session.execute(
            select(Entity).where(
                Entity.user_id == user_id,
                Entity.name == ext_entity.name,
                Entity.entity_type == ext_entity.entity_type
            )
        ).scalar_one_or_none()

        if existing_entity:
            if existing_entity.attributes is None:
                existing_entity.attributes = {}
            existing_entity.attributes.update(attr_dict)
            existing_entity.updated_at = datetime.now(timezone.utc)
            entity_id_map[ext_entity.name] = existing_entity.id
            resolved_entity = existing_entity
        else:
            new_entity = Entity(
                user_id=user_id,
                name=ext_entity.name,
                entity_type=ext_entity.entity_type,
                attributes=attr_dict
            )
            db_session.add(new_entity)
            db_session.flush()
            entity_id_map[ext_entity.name] = new_entity.id
            resolved_entity = new_entity

        # Contradiction management for role/profession facts.
        if ext_entity.entity_type.lower() in {"meslek", "rol", "role"} and extraction.fact_status in {"confirmed", "inferred"}:
            stale_facts = db_session.execute(
                select(MemoryFact).where(
                    MemoryFact.user_id == user_id,
                    MemoryFact.entity_id != resolved_entity.id,
                    MemoryFact.fact_status.in_(["confirmed", "inferred"]),
                )
            ).scalars().all()
            for stale_fact in stale_facts:
                if "meslek" in stale_fact.fact_text.lower() or "rol" in stale_fact.fact_text.lower():
                    stale_fact.fact_status = "outdated"

        db_session.add(
            MemoryFact(
                user_id=user_id,
                entity_id=resolved_entity.id,
                source_message_id=source_message_id,
                fact_text=f"{ext_entity.entity_type}: {ext_entity.name}",
                fact_status=extraction.fact_status if extraction.fact_status in {"confirmed", "inferred", "negated", "outdated"} else "confirmed",
                confidence_score=_clamp_confidence(ext_entity.confidence_score),
                evidence_text=(ext_entity.evidence_text or "")[:500],
            )
        )

    for ext_rel in extraction.relations:
        # Convert List[Attribute] to Dict[str, Any]
        attr_dict = {attr.key: attr.value for attr in ext_rel.attributes}
        
        source_id = entity_id_map.get(ext_rel.source_entity_name)
        target_id = entity_id_map.get(ext_rel.target_entity_name)

        if not source_id or not target_id:
            continue
            
        existing_relation = db_session.execute(
            select(Relation).where(
                Relation.source_entity_id == source_id,
                Relation.target_entity_id == target_id,
                Relation.relation_type == ext_rel.relation_type
            )
        ).scalar_one_or_none()
        
        if existing_relation:
            if existing_relation.attributes is None:
                existing_relation.attributes = {}
            existing_relation.attributes.update(attr_dict)
            resolved_relation = existing_relation
        else:
            new_relation = Relation(
                source_entity_id=source_id,
                target_entity_id=target_id,
                relation_type=ext_rel.relation_type,
                attributes=attr_dict
            )
            db_session.add(new_relation)
            db_session.flush()
            resolved_relation = new_relation

        db_session.add(
            MemoryFact(
                user_id=user_id,
                relation_id=resolved_relation.id,
                source_message_id=source_message_id,
                fact_text=f"{ext_rel.source_entity_name} -> {ext_rel.relation_type} -> {ext_rel.target_entity_name}",
                fact_status=extraction.fact_status if extraction.fact_status in {"confirmed", "inferred", "negated", "outdated"} else "confirmed",
                confidence_score=_clamp_confidence(ext_rel.confidence_score),
                evidence_text=(ext_rel.evidence_text or "")[:500],
            )
        )
            
    db_session.commit()
