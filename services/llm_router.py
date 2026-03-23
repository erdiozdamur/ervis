import os
import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
# Load environment variables (e.g., OPENAI_API_KEY)
# load_dotenv is handled globally in api.py

# Avoid immediate instantiation to prevent crash if API_KEY is missing during startup
_client: Optional[AsyncOpenAI] = None

def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "your_api_key_here":
            raise ValueError("OPENAI_API_KEY is missing. Please set it in the .env file.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

class IntentType(str, Enum):
    LOG_ENTITY = "LOG_ENTITY"
    QUERY_KNOWLEDGE = "QUERY_KNOWLEDGE"
    EXECUTE_TOOL = "EXECUTE_TOOL"
    GENERAL_CHAT = "GENERAL_CHAT"

class IntentResponse(BaseModel):
    intent: IntentType = Field(description="The classified intent of the user input.")
    confidence_score: float = Field(description="Confidence score between 0.0 and 1.0", ge=0.0, le=1.0)
    extracted_entities: List[str] = Field(description="List of extracted main entities or keywords from the input. For example: ['Passat B7', 'Bakım']")
    reasoning: str = Field(description="Very short explanation of why this intent was chosen by the model.")

SYSTEM_PROMPT = """You are the core intent router for Ervis, a generic, autonomous, and self-evolving AI agent system.
Your goal is to accurately classify the user's input into one of the available intent categories. 

### CRITICAL RULES:
1. MANDATORY ACTION (EXECUTE_TOOL): If the user's sentence contains a clear ACTION or COMMAND using imperative verbs like "oluştur", "ekle", "aç", "kapat", "çalıştır", "hatırlat", "ayarla", "yaz", "göster", "kontrol et", or "listele", this MUST be classified as EXECUTE_TOOL. **IMPORTANT:** Questions like "X var mı?" (Do I have X?) where X is a Task, Reminder, or Appointment MUST also be EXECUTE_TOOL (e.g., "Görevim var mı?", "Bana bir notun var mı?").
2. OVERRIDE LOGGING: Even if the sentence contains detailed entities, if the end goal is to perform an action or list/check records (e.g., "... hatırlatıcıları göster", "... görevim var mı?"), the intent is EXECUTE_TOOL.
3. QUERY_KNOWLEDGE PRIORITY: If the sentence is a QUESTION about facts, past events, or entity properties (e.g., "Yağı ne zaman değişti?", "Passat nerede?"), it is QUERY_KNOWLEDGE. However, if the question is about checking/listing Tasks/Reminders, it is ALWAYS EXECUTE_TOOL.
4. LOG_ENTITY CRITERIA: ONLY choose LOG_ENTITY if the user is purely PROVIDING INFORMATION about something they did or an observation they made.

Categories:
- EXECUTE_TOOL: The user wants the system to DO something (create, set, control, remind).
- LOG_ENTITY: The user is purely informing the system about a fact or event to remember.
- QUERY_KNOWLEDGE: The user is asking about previously stored information.
- GENERAL_CHAT: The user is greeting or having a social conversation.

Choose the most appropriate intent based on these strict guidelines.
"""

async def analyze_user_input(user_input: str) -> tuple[IntentResponse, str]:
    """
    Analyzes the user input asynchronously using an LLM to determine intent, 
    confidence score, extracted entities, and reasoning.
    """
    client = get_openai_client()
    current_date = datetime.now().strftime("%d %B %Y %A")
    response = await client.beta.chat.completions.parse(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nBUGÜNÜN TARİHİ: {current_date}"},
            {"role": "user", "content": user_input}
        ],
        response_format=IntentResponse,
        temperature=0.0
    )
    
    return response.choices[0].message.parsed, response.model
