import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from models import KnowledgeDocument, KnowledgeChunk
from services.cache_service import get_embedding

_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing. Please set it in the .env file.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


def _normalize_text(text: str) -> str:
    normalized = re.sub(r"\r\n?", "\n", text or "")
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def split_into_semantic_chunks(content: str, max_chars: int = 1800, overlap_chars: int = 220) -> List[Dict[str, Any]]:
    """
    Section-aware chunking:
    - Splits by heading-like lines first.
    - Falls back to paragraph windows with overlap.
    """
    text = _normalize_text(content)
    if not text:
        return []

    lines = text.split("\n")
    sections: List[Dict[str, str]] = []
    current_title = "Genel"
    current_body: List[str] = []

    heading_pattern = re.compile(r"^(#{1,6}\s+.+|\d+(\.\d+)*\s+.+|[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s\-]{3,})$")

    def flush_section():
        body = "\n".join(current_body).strip()
        if body:
            sections.append({"title": current_title, "body": body})

    for line in lines:
        stripped = line.strip()
        if heading_pattern.match(stripped):
            flush_section()
            current_title = stripped.lstrip("#").strip()
            current_body = []
        else:
            current_body.append(line)
    flush_section()

    chunks: List[Dict[str, Any]] = []
    chunk_index = 0

    for section in sections:
        section_title = section["title"]
        body = section["body"]
        if len(body) <= max_chars:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "section_title": section_title,
                    "content": body,
                    "token_count_hint": max(1, len(body) // 4),
                }
            )
            chunk_index += 1
            continue

        paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
        window = ""
        for paragraph in paragraphs:
            candidate = f"{window}\n\n{paragraph}".strip() if window else paragraph
            if len(candidate) <= max_chars:
                window = candidate
                continue

            if window:
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "section_title": section_title,
                        "content": window,
                        "token_count_hint": max(1, len(window) // 4),
                    }
                )
                chunk_index += 1
                tail = window[-overlap_chars:] if overlap_chars > 0 else ""
                window = f"{tail}\n\n{paragraph}".strip() if tail else paragraph
            else:
                # single giant paragraph fallback
                start = 0
                while start < len(paragraph):
                    end = min(start + max_chars, len(paragraph))
                    part = paragraph[start:end]
                    chunks.append(
                        {
                            "chunk_index": chunk_index,
                            "section_title": section_title,
                            "content": part,
                            "token_count_hint": max(1, len(part) // 4),
                        }
                    )
                    chunk_index += 1
                    if end >= len(paragraph):
                        break
                    start = max(0, end - overlap_chars)
                window = ""

        if window:
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "section_title": section_title,
                    "content": window,
                    "token_count_hint": max(1, len(window) // 4),
                }
            )
            chunk_index += 1

    return chunks


async def summarize_document_for_indexing(title: str, content: str, domain: Optional[str], product: Optional[str]) -> str:
    client = get_openai_client()
    truncated = content[:7000]
    system_prompt = (
        "Bir ürün bilgi mimarısın. Sana verilen uzun dokümanı retrieval için özetle. "
        "JSON vermeden, düz metin maddeler halinde: Amaç, Kapsam, Ana kararlar, Kritik metrikler, "
        "Varsayımlar, İstisnalar, Riskler, Güncelleme ihtiyacı."
    )
    user_prompt = (
        f"Doküman Başlığı: {title}\n"
        f"Domain: {domain or 'belirtilmedi'}\n"
        f"Ürün: {product or 'belirtilmedi'}\n\n"
        f"İçerik:\n{truncated}"
    )
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.0,
        max_tokens=500,
    )
    return (response.choices[0].message.content or "").strip()


async def classify_query_for_routing(query: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    client = get_openai_client()
    now = datetime.utcnow().strftime("%Y-%m-%d")
    system_prompt = (
        "Bir knowledge routing hakemisin. Kullanıcı sorgusunu sınıflandır. "
        "Sadece geçerli JSON döndür."
    )
    metadata_str = str(metadata or {})
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Tarih: {now}\n"
                    f"Sorgu: {query}\n"
                    f"Bağlam: {metadata_str}\n\n"
                    'JSON format: {"domain":"product|business|tech|ops|legal|general",'
                    ' "needs_recent":true|false, "product":"string|null", "reason":"kısa"}'
                ),
            },
        ],
        temperature=0.0,
        max_tokens=220,
    )
    raw = (response.choices[0].message.content or "").strip()
    try:
        import json

        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return {"domain": "general", "needs_recent": False, "product": None, "reason": "fallback"}
        return {
            "domain": str(parsed.get("domain") or "general"),
            "needs_recent": bool(parsed.get("needs_recent", False)),
            "product": parsed.get("product"),
            "reason": str(parsed.get("reason") or ""),
        }
    except Exception:
        return {"domain": "general", "needs_recent": False, "product": None, "reason": "fallback-parse"}


async def upsert_document_with_chunks(
    db_session: Session,
    user_id: uuid.UUID,
    title: str,
    content: str,
    source_type: str = "manual",
    source_ref: Optional[str] = None,
    domain: Optional[str] = None,
    product: Optional[str] = None,
    language: Optional[str] = None,
    version_tag: Optional[str] = None,
    tags: Optional[Dict[str, Any]] = None,
) -> KnowledgeDocument:
    cleaned_title = (title or "").strip()
    cleaned_content = _normalize_text(content)
    if not cleaned_title:
        raise ValueError("title boş olamaz")
    if len(cleaned_content) < 40:
        raise ValueError("content çok kısa, en az 40 karakter olmalı")

    summary = await summarize_document_for_indexing(cleaned_title, cleaned_content, domain, product)

    doc = KnowledgeDocument(
        user_id=user_id,
        title=cleaned_title,
        source_type=source_type,
        source_ref=source_ref,
        domain=domain,
        product=product,
        language=language,
        version_tag=version_tag,
        tags=tags or {},
        summary=summary,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    chunks = split_into_semantic_chunks(cleaned_content)
    if not chunks:
        raise ValueError("chunk üretilemedi")

    rows: List[KnowledgeChunk] = []
    for c in chunks:
        emb = await get_embedding(c["content"])
        rows.append(
            KnowledgeChunk(
                document_id=doc.id,
                user_id=user_id,
                chunk_index=c["chunk_index"],
                section_title=c.get("section_title"),
                content=c["content"],
                token_count_hint=int(c["token_count_hint"]),
                embedding=emb,
                metadata={
                    "domain": domain,
                    "product": product,
                    "source_type": source_type,
                    "version_tag": version_tag,
                },
            )
        )

    db_session.add_all(rows)
    db_session.commit()
    db_session.refresh(doc)
    return doc


async def retrieve_knowledge_context(
    db_session: Session,
    user_id: uuid.UUID,
    query: str,
    metadata: Optional[Dict[str, Any]] = None,
    top_k: int = 8,
) -> Dict[str, Any]:
    query_embedding = await get_embedding(query)
    routing = await classify_query_for_routing(query, metadata=metadata)

    domain_filter = routing.get("domain") if routing.get("domain") and routing.get("domain") != "general" else None
    product_filter = (routing.get("product") or "").strip() or None

    distance_expr = KnowledgeChunk.embedding.cosine_distance(query_embedding)
    stmt = (
        select(KnowledgeChunk, KnowledgeDocument, distance_expr.label("distance"))
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .where(KnowledgeChunk.user_id == user_id)
    )
    if domain_filter:
        stmt = stmt.where(KnowledgeDocument.domain == domain_filter)
    if product_filter:
        stmt = stmt.where(KnowledgeDocument.product == product_filter)

    rows = db_session.execute(stmt.order_by("distance").limit(max(top_k * 4, 20))).all()

    ranked = []
    now = datetime.utcnow().replace(tzinfo=None)
    for chunk, doc, distance in rows:
        similarity = max(0.0, 1.0 - float(distance))
        recency_days = max(0.0, (now - (doc.updated_at.replace(tzinfo=None) if doc.updated_at else now)).days)
        recency_bonus = 0.08 if recency_days <= 30 else (0.03 if recency_days <= 120 else 0.0)
        meta_bonus = 0.0
        if domain_filter and doc.domain == domain_filter:
            meta_bonus += 0.08
        if product_filter and doc.product == product_filter:
            meta_bonus += 0.1
        score = similarity + recency_bonus + meta_bonus
        ranked.append((score, chunk, doc, similarity))

    ranked.sort(key=lambda x: x[0], reverse=True)
    selected = ranked[:top_k]

    sources = []
    context_lines = []
    for _, chunk, doc, similarity in selected:
        source = {
            "document_id": str(doc.id),
            "title": doc.title,
            "domain": doc.domain,
            "product": doc.product,
            "section": chunk.section_title,
            "similarity": round(similarity, 4),
        }
        sources.append(source)
        context_lines.append(
            f"[KNOWLEDGE|Doc:{doc.title}|Section:{chunk.section_title or 'Genel'}|Domain:{doc.domain or 'n/a'}|Product:{doc.product or 'n/a'}|sim={similarity:.3f}]\n{chunk.content}"
        )

    return {
        "routing": routing,
        "sources": sources,
        "context": "\n\n".join(context_lines) if context_lines else "",
    }


def list_documents(db_session: Session, user_id: uuid.UUID, limit: int = 50) -> List[KnowledgeDocument]:
    safe_limit = max(1, min(limit, 200))
    return db_session.execute(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.user_id == user_id)
        .order_by(KnowledgeDocument.updated_at.desc())
        .limit(safe_limit)
    ).scalars().all()


def delete_document(db_session: Session, user_id: uuid.UUID, document_id: uuid.UUID) -> bool:
    doc = db_session.execute(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.user_id == user_id,
        )
    ).scalar_one_or_none()
    if not doc:
        return False

    db_session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id == document_id))
    db_session.delete(doc)
    db_session.commit()
    return True
