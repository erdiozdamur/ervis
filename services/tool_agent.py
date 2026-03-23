import os
import uuid
import json
from typing import Optional, List, Dict, Any
from openai import AsyncOpenAI
from sqlalchemy.orm import Session
from sqlalchemy import select
from models import Task

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
        return tool_result # Fallback to original mechanical message

# 4. TOOL EXECUTION LOGIC
async def execute_tool_for_user(user_id: uuid.UUID, user_input: str, db_session: Session) -> tuple[str, str]:
    client = get_openai_client()
    
    system_prompt = """Sen Ervis'in araç kullanım katmanısın. Kullanıcının isteğine göre uygun aracı seç ve çalıştır.
HATIRLATICI/GÖREV LİSTELEME: Kullanıcı "hatırlatıcılarım", "görevlerim", "listele", "göster", "neler var?", "var mı?" gibi ifadeler kullanırsa mutlaka 'show_tasks' aracını çağır."""

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
                # Refine the mechanical raw_result into a natural response
                natural_response = await generate_natural_response(user_input, function_name, raw_result)
                return natural_response, response.model
                
    return "Bu işlem için uygun bir araç bulunamadı veya anlaşılamadı.", response.model
