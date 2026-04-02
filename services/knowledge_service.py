import os
import uuid
from typing import Any, Optional

from openai import AsyncOpenAI
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from models import KnowledgeChunk, KnowledgeDocument

_client: Optional[AsyncOpenAI] = None


DEFAULT_EMBEDDING_SETTINGS: dict[str, Any] = {
    "model": "text-embedding-3-large",
    "chunk_size": 1000,
    "chunk_overlap": 150,
    "min_chunk_size": 250,
    "max_chunk_size": 1800,
    "split_strategy": "recursive",
    "separators": "\\n\\n,\\n,. , ",
    "preserve_paragraphs": True,
    "normalize_whitespace": True,
    "lowercase": False,
    "remove_urls": False,
    "remove_tables": False,
    "language_hint": "tr",
    "top_k_index": 8,
    "score_threshold": 0.2,
    "re_rank_enabled": True,
    "re_rank_top_n": 24,
    "batch_size": 32,
    "max_tokens_per_chunk": 800,
}


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing. Please set it in the .env file.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


def normalize_embedding_settings(settings: Optional[dict[str, Any]]) -> dict[str, Any]:
    merged = {**DEFAULT_EMBEDDING_SETTINGS, **(settings or {})}
    merged["model"] = merged.get("model") if merged.get("model") in {"text-embedding-3-small", "text-embedding-3-large"} else "text-embedding-3-large"
    for int_key, minimum, maximum in [
        ("chunk_size", 200, 4000),
        ("chunk_overlap", 0, 600),
        ("min_chunk_size", 100, 2000),
        ("max_chunk_size", 200, 6000),
        ("top_k_index", 1, 50),
        ("re_rank_top_n", 1, 80),
        ("batch_size", 1, 128),
        ("max_tokens_per_chunk", 100, 4000),
    ]:
        try:
            val = int(merged.get(int_key, DEFAULT_EMBEDDING_SETTINGS[int_key]))
        except Exception:
            val = DEFAULT_EMBEDDING_SETTINGS[int_key]
        merged[int_key] = max(minimum, min(maximum, val))

    try:
        score = float(merged.get("score_threshold", DEFAULT_EMBEDDING_SETTINGS["score_threshold"]))
    except Exception:
        score = DEFAULT_EMBEDDING_SETTINGS["score_threshold"]
    merged["score_threshold"] = max(0.0, min(1.0, score))

    for bool_key in ["preserve_paragraphs", "normalize_whitespace", "lowercase", "remove_urls", "remove_tables", "re_rank_enabled"]:
        merged[bool_key] = bool(merged.get(bool_key, DEFAULT_EMBEDDING_SETTINGS[bool_key]))

    separators = merged.get("separators") or DEFAULT_EMBEDDING_SETTINGS["separators"]
    merged["separators"] = str(separators)
    merged["language_hint"] = str(merged.get("language_hint") or "tr")[:16]
    merged["split_strategy"] = str(merged.get("split_strategy") or "recursive")
    return merged


def _apply_text_cleanup(text: str, settings: dict[str, Any]) -> str:
    prepared = (text or "").strip()
    if settings.get("normalize_whitespace"):
        prepared = "\n".join([" ".join(line.split()) for line in prepared.splitlines()])
    if settings.get("lowercase"):
        prepared = prepared.lower()
    return prepared.strip()


def split_into_chunks(text: str, settings: dict[str, Any]) -> list[str]:
    cleaned = _apply_text_cleanup(text, settings)
    if not cleaned:
        return []

    chunk_size = settings["chunk_size"]
    overlap = settings["chunk_overlap"]
    min_chunk_size = settings["min_chunk_size"]
    separators = [s.encode("utf-8").decode("unicode_escape") for s in settings.get("separators", "\\n\\n,\\n").split(",") if s]

    units = [cleaned]
    for sep in separators:
        if not sep:
            continue
        next_units = []
        for unit in units:
            if len(unit) <= chunk_size:
                next_units.append(unit)
                continue
            parts = [p.strip() for p in unit.split(sep) if p.strip()]
            if len(parts) <= 1:
                next_units.append(unit)
            else:
                next_units.extend(parts)
        units = next_units

    chunks: list[str] = []
    buffer = ""
    for unit in units:
        candidate = f"{buffer}\n{unit}".strip() if buffer else unit
        if len(candidate) <= chunk_size:
            buffer = candidate
            continue
        if buffer and len(buffer) >= min_chunk_size:
            chunks.append(buffer)
            tail = buffer[-overlap:] if overlap > 0 else ""
            buffer = f"{tail}\n{unit}".strip()
            if len(buffer) > chunk_size:
                chunks.append(buffer[:chunk_size])
                buffer = buffer[chunk_size - overlap:] if overlap > 0 else ""
        else:
            chunks.append(candidate[:chunk_size])
            buffer = candidate[chunk_size - overlap:] if overlap > 0 else ""

    if buffer.strip():
        chunks.append(buffer.strip())

    max_chunk_size = settings["max_chunk_size"]
    final_chunks: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chunk_size:
            final_chunks.append(chunk)
            continue
        start = 0
        while start < len(chunk):
            end = min(len(chunk), start + max_chunk_size)
            part = chunk[start:end].strip()
            if part:
                final_chunks.append(part)
            if end >= len(chunk):
                break
            start = max(0, end - overlap)

    return [c for c in final_chunks if len(c.strip()) >= min_chunk_size]


async def embed_texts(texts: list[str], model: str) -> list[list[float]]:
    client = get_openai_client()
    safe_model = model if model in {"text-embedding-3-small", "text-embedding-3-large"} else "text-embedding-3-small"
    response = await client.embeddings.create(input=texts, model=safe_model)
    return [row.embedding for row in response.data]


async def upsert_document_with_chunks(
    db_session: Session,
    user_id: uuid.UUID,
    title: str,
    content: str,
    metadata: dict[str, Any],
    embedding_settings: Optional[dict[str, Any]],
) -> KnowledgeDocument:
    normalized_settings = normalize_embedding_settings(embedding_settings)
    chunks = split_into_chunks(content, normalized_settings)
    if not chunks:
        raise ValueError("Doküman metni indekslenebilir parçalara ayrılamadı.")

    embeddings = await embed_texts(chunks, normalized_settings["model"])
    doc = KnowledgeDocument(
        user_id=user_id,
        title=title,
        content=content,
        domain=metadata.get("domain"),
        product=metadata.get("product"),
        version_tag=metadata.get("version_tag"),
        source_type=metadata.get("source_type"),
        source_ref=metadata.get("source_ref"),
        language=metadata.get("language"),
        chunk_count=len(chunks),
        embedding_settings=normalized_settings,
    )
    db_session.add(doc)
    db_session.flush()

    for idx, chunk in enumerate(chunks):
        db_session.add(
            KnowledgeChunk(
                document_id=doc.id,
                user_id=user_id,
                chunk_index=idx,
                content=chunk,
                embedding=embeddings[idx],
                metadata={"title": title, "domain": metadata.get("domain")},
            )
        )
    db_session.commit()
    db_session.refresh(doc)
    return doc


async def retrieve_document_context(
    db_session: Session,
    user_id: uuid.UUID,
    query: str,
    top_k_default: int = 8,
) -> tuple[str, list[dict[str, Any]]]:
    docs = db_session.execute(
        select(KnowledgeDocument).where(KnowledgeDocument.user_id == user_id).order_by(KnowledgeDocument.created_at.desc()).limit(120)
    ).scalars().all()
    if not docs:
        return "", []

    query_embedding = (await embed_texts([query], "text-embedding-3-small"))[0]
    score_rows: list[tuple[float, KnowledgeChunk, KnowledgeDocument]] = []

    docs_by_id = {d.id: d for d in docs}
    chunks = db_session.execute(
        select(KnowledgeChunk).where(KnowledgeChunk.user_id == user_id).limit(4000)
    ).scalars().all()

    for chunk in chunks:
        doc = docs_by_id.get(chunk.document_id)
        if not doc:
            continue
        settings = normalize_embedding_settings(doc.embedding_settings)
        threshold = float(settings.get("score_threshold", 0.2))
        # cosine similarity manual fallback
        dot = sum((a * b for a, b in zip(query_embedding, chunk.embedding)))
        mag1 = max(1e-9, sum((a * a for a in query_embedding)) ** 0.5)
        mag2 = max(1e-9, sum((b * b for b in chunk.embedding)) ** 0.5)
        sim = dot / (mag1 * mag2)
        if sim >= threshold:
            score_rows.append((sim, chunk, doc))

    score_rows.sort(key=lambda x: x[0], reverse=True)
    if not score_rows:
        return "", []

    top_k = min(max(top_k_default, 1), 20)
    picked = score_rows[:top_k]
    context_parts = []
    sources = []
    for sim, chunk, doc in picked:
        context_parts.append(f"[Doküman: {doc.title} | benzerlik={sim:.3f}]\n{chunk.content[:1600]}")
        sources.append({"document_id": str(doc.id), "title": doc.title, "score": round(sim, 4), "chunk_index": chunk.chunk_index})

    return "\n\n".join(context_parts), sources


def recommend_embedding_settings(text: str, extension: str, language_hint: str = "tr") -> tuple[dict[str, Any], str, dict[str, str]]:
    length = len((text or "").strip())
    ext = (extension or "").lower()
    is_big_or_pdf = length > 25000 or ext == "pdf"

    tuned = normalize_embedding_settings({
        "model": "text-embedding-3-large" if is_big_or_pdf else "text-embedding-3-small",
        "chunk_size": 1400 if is_big_or_pdf else 900,
        "chunk_overlap": 180 if is_big_or_pdf else 120,
        "min_chunk_size": 300 if is_big_or_pdf else 200,
        "max_chunk_size": 2200 if is_big_or_pdf else 1400,
        "top_k_index": 10 if is_big_or_pdf else 8,
        "score_threshold": 0.18 if is_big_or_pdf else 0.2,
        "re_rank_top_n": 30 if is_big_or_pdf else 20,
        "batch_size": 48 if is_big_or_pdf else 32,
        "max_tokens_per_chunk": 1000 if is_big_or_pdf else 750,
        "language_hint": language_hint or "tr",
    })

    reason = (
        "Doküman uzun/PDF olduğu için bağlam kaybını azaltmak adına daha büyük chunk ve güçlü model seçildi."
        if is_big_or_pdf
        else "Doküman orta/kısa olduğu için maliyet ve hız dengesinde küçük model + kompakt chunk seçildi."
    )
    explanations = {
        "model": "Large model kaliteyi artırır, small model ise daha hızlı/ekonomiktir.",
        "chunk_size": "Daha uzun parçalarda bağlam bütünlüğü, kısa parçalarda odak artar.",
        "chunk_overlap": "Örtüşme sınırdaki bilgilerin kaybolmasını engeller.",
        "score_threshold": "Eşik yükseldikçe alakasız chunk'lar elenir.",
        "top_k_index": "Sorgu başına kaç chunk getirileceğini belirler.",
        "re_rank_enabled": "İkinci sıralama daha ilgili sonuçları öne taşır.",
        "re_rank_top_n": "Yeniden sıralamada değerlendirilecek aday sayısıdır.",
        "batch_size": "Embedding çağrısında parti büyüklüğü hız/maliyet dengesini etkiler.",
        "max_tokens_per_chunk": "Chunk başına token sınırı model giriş güvenliğini artırır.",
        "split_strategy": "Metnin hangi mantıkla bölüneceğini kontrol eder.",
        "separators": "Paragraf/cümle ayırıcıları doğal bölünmeyi iyileştirir.",
        "preserve_paragraphs": "Paragraf bütünlüğünü koruyarak anlam kaybını azaltır.",
        "normalize_whitespace": "Gürültülü boşlukları temizleyip embedding kalitesini stabilize eder.",
        "lowercase": "Bazı dillerde normalize etmeyi kolaylaştırır; özel isim hassasiyetini azaltabilir.",
        "remove_urls": "URL gürültüsünü temizlemek için kullanılabilir.",
        "remove_tables": "Tablo yoğun metinlerde anlamsız satırları filtrelemek için kullanılabilir.",
        "language_hint": "Dil ipucu, parçalama ve yorumlama tercihlerini dengeler.",
    }
    return tuned, reason, explanations


def delete_document(db_session: Session, user_id: uuid.UUID, document_id: uuid.UUID) -> bool:
    doc = db_session.execute(
        select(KnowledgeDocument).where(KnowledgeDocument.id == document_id, KnowledgeDocument.user_id == user_id)
    ).scalars().first()
    if not doc:
        return False
    db_session.execute(delete(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id))
    db_session.delete(doc)
    db_session.commit()
    return True
