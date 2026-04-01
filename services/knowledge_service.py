import os
import re
import uuid
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from openai import AsyncOpenAI
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from models import KnowledgeDocument, KnowledgeChunk
from services.cache_service import get_embedding

_client: Optional[AsyncOpenAI] = None


THRESHOLD_IGNORE_MAX = float(os.getenv("KNOWLEDGE_SCORE_IGNORE_MAX", "0.45"))
THRESHOLD_CONFIRM_MAX = float(os.getenv("KNOWLEDGE_SCORE_CONFIRM_MAX", "0.70"))
HIGH_CONFIDENCE_TIE_GAP = float(os.getenv("KNOWLEDGE_SCORE_TIE_GAP", "0.08"))
MIN_SEMANTIC_FOR_RELEVANCE = float(os.getenv("KNOWLEDGE_MIN_SEMANTIC", "0.58"))
MIN_LEXICAL_FOR_RELEVANCE = float(os.getenv("KNOWLEDGE_MIN_LEXICAL", "0.18"))
KNOWLEDGE_EMBEDDING_MODEL = os.getenv("KNOWLEDGE_EMBEDDING_MODEL", "text-embedding-3-small")


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


def _safe_int(value: Any, default: int, min_value: int, max_value: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(min_value, min(parsed, max_value))


def _tokenize_for_overlap(text: str) -> List[str]:
    cleaned = re.sub(r"[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s]", " ", (text or "").lower())
    tokens = [t for t in cleaned.split() if len(t) >= 3]
    return tokens


def _calc_lexical_overlap(query: str, *parts: Optional[str]) -> float:
    query_tokens = set(_tokenize_for_overlap(query))
    if not query_tokens:
        return 0.0
    joined = " ".join([p for p in parts if p])
    doc_tokens = set(_tokenize_for_overlap(joined))
    if not doc_tokens:
        return 0.0
    return len(query_tokens & doc_tokens) / float(len(query_tokens))


def _query_internal_signal(query: str) -> float:
    text = (query or "").lower()
    strong_cues = [
        "doküman", "döküman", "intranet", "wiki", "knowledge", "kb", "policy", "prosedür",
        "sistemde", "bu belgede", "dokümanda", "kılavuz", "manual", "runbook",
    ]
    weak_cues = ["içerik", "tanım", "ne işe yarar", "nasıl çalışır", "versiyon", "madde"]
    score = 0.0
    if any(c in text for c in strong_cues):
        score += 0.7
    if any(c in text for c in weak_cues):
        score += 0.2
    if "?" in text:
        score += 0.1
    return min(1.0, score)


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


def _default_embedding_profile(content: str) -> Dict[str, Any]:
    text = _normalize_text(content)
    length = len(text)
    heading_count = len(re.findall(r"(?m)^(#{1,6}\s+.+|\d+(\.\d+)*\s+.+)$", text))

    if length <= 1800:
        chunk_max = 1200
        overlap = 120
    elif length <= 12000:
        chunk_max = 1600
        overlap = 200
    else:
        chunk_max = 2200
        overlap = 280

    if heading_count >= 8:
        overlap = min(overlap + 40, 320)

    return {
        "model": KNOWLEDGE_EMBEDDING_MODEL,
        "chunk_max_chars": chunk_max,
        "chunk_overlap_chars": overlap,
        "prepend_title_to_chunk": True,
        "prepend_section_to_chunk": True,
        "keyword_hint_density": "medium",
        "reason": "fallback-heuristic",
    }


async def choose_embedding_profile_for_document(
    title: str,
    content: str,
    domain: Optional[str],
    product: Optional[str],
) -> Dict[str, Any]:
    """
    Closed-box embedding ayarlarını doküman içeriğine göre otomatik belirleyen mini agent.
    """
    fallback = _default_embedding_profile(content)
    client = get_openai_client()
    excerpt = _normalize_text(content)[:9000]
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Sen bir Embedding Indexing Agent'sin. "
                        "Amaç: verilen dokümanı indekslemek için en doğru ayarları seçmek. "
                        "Sadece geçerli JSON döndür."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Başlık: {title}\n"
                        f"Domain: {domain or 'belirtilmedi'}\n"
                        f"Ürün: {product or 'belirtilmedi'}\n"
                        f"Doküman uzunluğu: {len(content)} karakter\n\n"
                        f"İçerik örneği:\n{excerpt}\n\n"
                        "JSON formatı: "
                        '{"model":"text-embedding-3-small","chunk_max_chars":1600,'
                        '"chunk_overlap_chars":220,"prepend_title_to_chunk":true,'
                        '"prepend_section_to_chunk":true,"keyword_hint_density":"low|medium|high",'
                        '"reason":"kısa gerekçe"}'
                    ),
                },
            ],
            temperature=0.0,
            max_tokens=260,
        )
        raw = (response.choices[0].message.content or "").strip()
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            return fallback
        return {
            "model": str(parsed.get("model") or KNOWLEDGE_EMBEDDING_MODEL),
            "chunk_max_chars": _safe_int(parsed.get("chunk_max_chars"), fallback["chunk_max_chars"], 900, 2600),
            "chunk_overlap_chars": _safe_int(parsed.get("chunk_overlap_chars"), fallback["chunk_overlap_chars"], 80, 400),
            "prepend_title_to_chunk": bool(parsed.get("prepend_title_to_chunk", True)),
            "prepend_section_to_chunk": bool(parsed.get("prepend_section_to_chunk", True)),
            "keyword_hint_density": str(parsed.get("keyword_hint_density") or fallback["keyword_hint_density"]).lower(),
            "reason": str(parsed.get("reason") or "llm-profile"),
        }
    except Exception:
        return fallback


def _compose_embedding_text(
    chunk_text: str,
    title: str,
    section_title: Optional[str],
    domain: Optional[str],
    product: Optional[str],
    profile: Dict[str, Any],
) -> str:
    parts: List[str] = []
    if profile.get("prepend_title_to_chunk"):
        parts.append(f"Doküman: {title}")
    if profile.get("prepend_section_to_chunk") and section_title:
        parts.append(f"Bölüm: {section_title}")
    if domain:
        parts.append(f"Alan: {domain}")
    if product:
        parts.append(f"Ürün: {product}")
    density = str(profile.get("keyword_hint_density") or "medium")
    if density == "high":
        parts.append("İpucu: kritik terimler ve prosedürel adımlar önceliklidir.")
    elif density == "low":
        parts.append("İpucu: doğal içerik öncelikli, bağlam enjeksiyonu minimal.")
    parts.append(chunk_text)
    return "\n".join(parts).strip()


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
    embedding_profile = await choose_embedding_profile_for_document(cleaned_title, cleaned_content, domain, product)
    merged_tags = dict(tags or {})
    merged_tags["indexing_profile"] = {
        "model": embedding_profile.get("model"),
        "chunk_max_chars": embedding_profile.get("chunk_max_chars"),
        "chunk_overlap_chars": embedding_profile.get("chunk_overlap_chars"),
        "keyword_hint_density": embedding_profile.get("keyword_hint_density"),
        "reason": embedding_profile.get("reason"),
    }

    doc = KnowledgeDocument(
        user_id=user_id,
        title=cleaned_title,
        source_type=source_type,
        source_ref=source_ref,
        domain=domain,
        product=product,
        language=language,
        version_tag=version_tag,
        tags=merged_tags,
        summary=summary,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    chunks = split_into_semantic_chunks(
        cleaned_content,
        max_chars=int(embedding_profile["chunk_max_chars"]),
        overlap_chars=int(embedding_profile["chunk_overlap_chars"]),
    )
    if not chunks:
        raise ValueError("chunk üretilemedi")

    rows: List[KnowledgeChunk] = []
    for c in chunks:
        embedding_input = _compose_embedding_text(
            chunk_text=c["content"],
            title=cleaned_title,
            section_title=c.get("section_title"),
            domain=domain,
            product=product,
            profile=embedding_profile,
        )
        emb = await get_embedding(
            embedding_input,
            model=str(embedding_profile.get("model") or KNOWLEDGE_EMBEDDING_MODEL),
        )
        rows.append(
            KnowledgeChunk(
                document_id=doc.id,
                user_id=user_id,
                chunk_index=c["chunk_index"],
                section_title=c.get("section_title"),
                content=c["content"],
                token_count_hint=int(c["token_count_hint"]),
                embedding=emb,
                chunk_metadata={
                    "domain": domain,
                    "product": product,
                    "source_type": source_type,
                    "version_tag": version_tag,
                    "embedding_model": embedding_profile.get("model"),
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
    internal_signal = _query_internal_signal(query)

    distance_expr = KnowledgeChunk.embedding.cosine_distance(query_embedding)
    stmt = (
        select(KnowledgeChunk, KnowledgeDocument, distance_expr.label("distance"))
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .where(KnowledgeChunk.user_id == user_id)
    )
    rows = db_session.execute(stmt.order_by("distance").limit(max(top_k * 6, 36))).all()

    ranked = []
    now = datetime.utcnow().replace(tzinfo=None)
    for chunk, doc, distance in rows:
        semantic_similarity = max(0.0, 1.0 - float(distance))
        lexical_overlap = _calc_lexical_overlap(query, chunk.content, doc.title, doc.summary, chunk.section_title)
        recency_days = max(0.0, (now - (doc.updated_at.replace(tzinfo=None) if doc.updated_at else now)).days)
        recency_score = 1.0 if recency_days <= 30 else (0.6 if recency_days <= 120 else 0.25)
        title_match = 1.0 if _calc_lexical_overlap(query, doc.title) >= 0.34 else 0.0
        section_match = 1.0 if _calc_lexical_overlap(query, chunk.section_title or "") >= 0.34 else 0.0
        metadata_score = 0.0
        if domain_filter and doc.domain == domain_filter:
            metadata_score += 0.5
        if product_filter and doc.product == product_filter:
            metadata_score += 0.5
        intent_score = min(1.0, metadata_score + (0.2 if section_match > 0 else 0.0))

        weighted_score = (
            0.28 * lexical_overlap
            + 0.42 * semantic_similarity
            + 0.15 * (0.6 * title_match + 0.4 * section_match)
            + 0.15 * intent_score
            + 0.05 * recency_score
        )
        if domain_filter and doc.domain != domain_filter:
            weighted_score -= 0.05
        if product_filter and doc.product and doc.product != product_filter:
            weighted_score -= 0.05
        ranked.append(
            (
                weighted_score,
                chunk,
                doc,
                semantic_similarity,
                lexical_overlap,
                title_match,
                section_match,
                intent_score,
                recency_score,
            )
        )

    ranked.sort(key=lambda x: x[0], reverse=True)
    filtered = [
        row for row in ranked
        if (
            row[3] >= MIN_SEMANTIC_FOR_RELEVANCE
            or row[4] >= MIN_LEXICAL_FOR_RELEVANCE
            or row[5] > 0.0
            or row[6] > 0.0
        )
    ]
    selected = (filtered or ranked)[:top_k]

    sources = []
    context_lines = []
    for score, chunk, doc, semantic_similarity, lexical_overlap, title_match, section_match, intent_score, recency_score in selected:
        source = {
            "document_id": str(doc.id),
            "title": doc.title,
            "domain": doc.domain,
            "product": doc.product,
            "section": chunk.section_title,
            "similarity": round(semantic_similarity, 4),
            "score": round(score, 4),
            "score_breakdown": {
                "lexical": round(lexical_overlap, 4),
                "semantic": round(semantic_similarity, 4),
                "title_match": round(title_match, 4),
                "section_match": round(section_match, 4),
                "intent": round(intent_score, 4),
                "recency": round(recency_score, 4),
            },
        }
        sources.append(source)
        context_lines.append(
            f"[KNOWLEDGE|Doc:{doc.title}|Section:{chunk.section_title or 'Genel'}|Domain:{doc.domain or 'n/a'}|Product:{doc.product or 'n/a'}|sim={semantic_similarity:.3f}|score={score:.3f}]\n{chunk.content}"
        )

    top_score = float(selected[0][0]) if selected else 0.0
    second_score = float(selected[1][0]) if len(selected) > 1 else 0.0
    decision = "use"
    top_lexical = float(selected[0][4]) if selected else 0.0
    top_semantic = float(selected[0][3]) if selected else 0.0
    if top_score < THRESHOLD_IGNORE_MAX:
        decision = "skip"
    elif internal_signal < 0.4 and top_score < THRESHOLD_CONFIRM_MAX and top_lexical < 0.24:
        # General sohbet/dünya bilgisi sorularında alakasız RAG enjeksiyonunu azalt.
        decision = "skip"
    elif top_semantic < 0.52 and top_lexical < 0.16:
        decision = "skip"
    elif top_score < THRESHOLD_CONFIRM_MAX:
        decision = "ask_user"
    elif second_score >= THRESHOLD_CONFIRM_MAX and abs(top_score - second_score) < HIGH_CONFIDENCE_TIE_GAP:
        decision = "ask_user_choice"

    context_text = "\n\n".join(context_lines) if context_lines else ""
    if decision == "skip":
        context_text = ""

    needs_user_confirmation = decision in {"ask_user", "ask_user_choice"}
    confirmation_prompt = ""
    if decision == "ask_user" and sources:
        s = sources[0]
        confirmation_prompt = (
            "En uygun bağlam adayı: "
            f"{s.get('title')} (skor={s.get('score')}). "
            "Bu bağlamı kullanarak devam etmemi ister misin?"
        )
    elif decision == "ask_user_choice" and len(sources) >= 2:
        s1, s2 = sources[0], sources[1]
        confirmation_prompt = (
            "İki güçlü bağlam buldum. Hangisini kullanayım?\n"
            f"1) {s1.get('title')} (skor={s1.get('score')})\n"
            f"2) {s2.get('title')} (skor={s2.get('score')})"
        )

    return {
        "routing": routing,
        "decision": decision,
        "top_score": round(top_score, 4),
        "second_score": round(second_score, 4),
        "thresholds": {
            "ignore_max": THRESHOLD_IGNORE_MAX,
            "confirm_max": THRESHOLD_CONFIRM_MAX,
            "high_confidence_tie_gap": HIGH_CONFIDENCE_TIE_GAP,
        },
        "needs_user_confirmation": needs_user_confirmation,
        "confirmation_prompt": confirmation_prompt,
        "sources": sources,
        "context": context_text,
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
