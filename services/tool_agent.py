import os
import uuid
import json
from typing import Any, Optional

from openai import AsyncOpenAI
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Task
from services.knowledge_service import retrieve_knowledge_context

# load_dotenv is handled globally in api.py
_client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing. Please set it in the .env file.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


class ToolHandlingDecision(BaseModel):
    mode: str = Field(description="EXECUTE_AVAILABLE_TOOL or DELIVER_CONTENT_DIRECTLY")
    requires_unavailable_integration: bool = Field(
        description="True when user requests an external action (jira/mail/crm etc.) that this system cannot execute directly."
    )
    reasoning: str = Field(description="Short reasoning.")


# 1. TOOL FUNCTIONS (Real Persistence)
async def create_task(user_id: uuid.UUID, title: str, description: str, db_session: Session) -> str:
    print(f"DEBUG: create_task called for user {user_id}, title: {title}")
    new_task = Task(
        user_id=user_id,
        title=title,
        description=description,
        status="pending"
    )
    db_session.add(new_task)
    db_session.commit()
    print(f"DEBUG: Task '{title}' committed to DB.")
    return f"Görev '{title}' başarıyla oluşturuldu ve kaydedildi."


async def show_tasks(user_id: uuid.UUID, db_session: Session, filter_keyword: Optional[str] = None) -> str:
    stmt = select(Task).where(Task.user_id == user_id, Task.status == "pending")
    if filter_keyword:
        stmt = stmt.where(Task.title.ilike(f"%{filter_keyword}%"))

    tasks = db_session.execute(stmt).scalars().all()

    if not tasks:
        return "Şu an kayıtlı bekleyen bir hatırlatıcınız veya göreviniz bulunmuyor."

    task_list = "\n".join([f"- {t.title}: {t.description or ''}" for t in tasks])
    return f"Bekleyen görevleriniz:\n{task_list}"


async def control_device(user_id: uuid.UUID, device_name: str, state: str) -> str:
    # still mock as we don't have smart home integration yet
    return f"Cihaz '{device_name}' durumu '{state}' olarak başarıyla güncellendi."


# 2. OPENAI TOOL SCHEMAS
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_task",
            "description": "Kullanıcı için yeni bir görev (task) veya iş listesi öğesi oluşturur.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Görevin başlığı."},
                    "description": {"type": "string", "description": "Görevin detaylı açıklaması."}
                },
                "required": ["title", "description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "show_tasks",
            "description": "Kullanıcının kayıtlı olan tüm görevlerini (tasks) ve hatırlatıcılarını listeler.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filter_keyword": {"type": "string", "description": "Belirli bir kelimeye göre filtreleme yapmak için kullanılır (isteğe bağlı)."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "control_device",
            "description": "Evdeki akıllı cihazları (ışık, klima, tv vb.) kontrol eder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "device_name": {"type": "string", "description": "Kontrol edilecek cihazın adı (örn. 'salon ışığı', 'klima')."},
                    "state": {"type": "string", "description": "Cihazın istenen durumu (örn. 'açık', 'kapalı', '24 derece')."}
                },
                "required": ["device_name", "state"]
            }
        }
    }
]


async def decide_tool_handling(user_input: str) -> ToolHandlingDecision:
    """
    Decide whether we should execute an available internal tool
    or directly deliver requested content to the user.
    """
    client = get_openai_client()
    system_prompt = """Sen Ervis'in eylem karar katmanısın.
Sistemde SADECE şu araçlar var:
- create_task: görev/hatırlatıcı kaydetme
- show_tasks: görevleri listeleme
- control_device: basit cihaz komutu

Karar ver:
1) Kullanıcı isteği bu üç araçtan biri ile GERÇEKTEN uygulanabiliyorsa mode=EXECUTE_AVAILABLE_TOOL.
2) Diğer tüm isteklerde mode=DELIVER_CONTENT_DIRECTLY.

Özellikle şu tür taleplerde DELIVER_CONTENT_DIRECTLY seç:
- "jira içeriği yaz", "mail taslağı oluştur", "metin/özet/duyuru hazırla"
- Harici sisteme kayıt/açma/gönderme isteniyor ama burada entegrasyon yoksa.

Kurallar:
- Entegrasyon yoksa 'yaptım/gönderdim/açtım' gibi iddiaya izin verme.
- requires_unavailable_integration sadece harici aksiyon talebi varsa true olsun.
"""

    response = await client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        response_format=ToolHandlingDecision,
        temperature=0.0,
    )
    return response.choices[0].message.parsed


# 3. CONVERSATIONAL REFINER
async def generate_natural_response(user_input: str, tool_name: str, tool_result: str) -> str:
    """
    Generates a natural, human-like response after a tool has been successfully executed.
    This uses a cheap LLM call to bridge the gap between 'system result' and 'premium assistant'.
    """
    client = get_openai_client()

    system_prompt = """Sen Ervis'sin. Bir aracı (tool) başarıyla çalıştırdın.
Görevin: Kullanıcının orijinal isteğini ve aracın sonucunu alıp, kullanıcıya işin bittiğini çok doğal, samimi ve yardımcı bir dille açıklamak.

KURALLAR:
1. Robotik olma ("işlem başarıyla tamamlandı" gibi ifadelerden kaçın).
2. Kullanıcının saydığı önemli detayları (örn. kıyma, saat, isim) mutlaka cümlede kullan.
3. Kısa, öz ve premium bir tonla konuş.
4. Sadece Türkçe cevap ver.
"""
    prompt = f"Kullanıcı İsteği: {user_input}\nÇalıştırılan Araç: {tool_name}\nAraç Sonucu: {tool_result}"

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error in generate_natural_response: {e}")
        return tool_result


def _format_knowledge_context_for_prompt(knowledge_result: dict[str, Any]) -> str:
    sources = knowledge_result.get("sources", []) or []
    context = (knowledge_result.get("context") or "").strip()
    if not sources or not context:
        return ""

    top_sources = []
    for source in sources[:3]:
        title = source.get("title") or "Bilinmeyen Kaynak"
        domain = source.get("domain") or "n/a"
        product = source.get("product") or "n/a"
        top_sources.append(f"- {title} (domain={domain}, product={product})")

    return (
        "\n\n[HIZLI BAĞLAM KONTROLÜ - KULLAN]:\n"
        + "\n".join(top_sources)
        + f"\n\n[BAĞLAM METNİ]:\n{context[:2200]}"
    )


async def generate_direct_content(
    user_input: str,
    requires_unavailable_integration: bool,
    knowledge_result: Optional[dict[str, Any]] = None,
) -> str:
    """
    Generate directly requested output (mail, jira text, announcement, etc.)
    without pretending a real external action was performed.
    """
    client = get_openai_client()
    transparency_note = """
Eğer kullanıcı harici bir sistemde aksiyon (ör. Jira açma, e-posta gönderme, CRM kaydetme) istiyorsa
ve gerçek entegrasyon yoksa ilk satırda kısa bir şeffaflık notu ver:
"Bunu ilgili sisteme otomatik işleyemiyorum; ama aşağıda doğrudan kullanabileceğin içeriği hazırladım."
""" if requires_unavailable_integration else ""

    knowledge_context = _format_knowledge_context_for_prompt(knowledge_result or {})

    system_prompt = f"""Sen Ervis'sin.
Görev: Kullanıcının istediği çıktıyı DOĞRUDAN üret.

Kurallar:
1. Kullanıcının istediği şeyi (mail, ticket içeriği, plan, rapor, metin vb.) tam ve kopyalanabilir biçimde ver.
2. Asla yapılmayan bir işlemi yapılmış gibi anlatma ("oluşturdum", "gönderdim", "açtım" deme).
3. Kısa bir girişten sonra esas çıktıyı ver; gereksiz açıklama yapma.
4. Sadece Türkçe cevap ver.
5. [HIZLI BAĞLAM KONTROLÜ - KULLAN] verilmişse çıktı içeriğini bu bağlama dayandır. Bağlam dışı iddia üretme.
{transparency_note}
{knowledge_context}
"""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input},
        ],
        temperature=0.4,
        max_tokens=600,
    )
    return response.choices[0].message.content.strip()


# 4. TOOL EXECUTION LOGIC
async def execute_tool_for_user(
    user_id: uuid.UUID,
    user_input: str,
    db_session: Session,
    metadata: Optional[dict[str, Any]] = None,
) -> tuple[str, str, list[dict[str, Any]]]:
    client = get_openai_client()

    decision = await decide_tool_handling(user_input)
    print(f"DEBUG: Tool handling decision={decision.mode}, unavailable_integration={decision.requires_unavailable_integration}")

    if decision.mode != "EXECUTE_AVAILABLE_TOOL":
        knowledge_result = await retrieve_knowledge_context(
            db_session=db_session,
            user_id=user_id,
            query=user_input,
            metadata=metadata or {},
            top_k=3,
        )
        direct_response = await generate_direct_content(
            user_input=user_input,
            requires_unavailable_integration=decision.requires_unavailable_integration,
            knowledge_result=knowledge_result,
        )
        return direct_response, "gpt-4o-mini", knowledge_result.get("sources", [])

    system_prompt = """Sen Ervis'in araç kullanım katmanısın. Kullanıcının isteğine göre uygun aracı seç ve çalıştır.
HATIRLATICI/GÖREV LİSTELEME: Kullanıcı "hatırlatıcılarım", "görevlerim", "listele", "göster", "neler var?", "var mı?" gibi ifadeler kullanırsa mutlaka 'show_tasks' aracını çağır.
Sadece gerçekten mevcut araçlarla yapılabilen isteklerde tool çağır."""

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input}
        ],
        tools=TOOLS,
        tool_choice="auto"
    )

    message = response.choices[0].message

    if message.tool_calls:
        for tool_call in message.tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)

            raw_result = ""
            if function_name == "create_task":
                print(f"DEBUG: Dispatching to create_task with args: {arguments}")
                raw_result = await create_task(user_id=user_id, db_session=db_session, **arguments)
            elif function_name == "show_tasks":
                print(f"DEBUG: Dispatching to show_tasks with args: {arguments}")
                raw_result = await show_tasks(user_id=user_id, db_session=db_session, **arguments)
            elif function_name == "control_device":
                raw_result = await control_device(user_id, **arguments)

            if raw_result:
                natural_response = await generate_natural_response(user_input, function_name, raw_result)
                return natural_response, response.model, []

    fallback = await generate_direct_content(
        user_input=user_input,
        requires_unavailable_integration=False,
    )
    return fallback, response.model, []
