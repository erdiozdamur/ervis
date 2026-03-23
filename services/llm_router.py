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
    extracted_entities: List[str] = Field(description="List of extracted main entities or keywords from the input.")
    suggested_acknowledgment: Optional[str] = Field(description="A natural, conversational, and human-like acknowledgment for the user. Only required for LOG_ENTITY or GENERAL_CHAT. For example: 'Anladım, saçlarının kumral olduğunu aklımda tutuyorum!' or 'Halı saha maçını not aldım, merak etme.'")
    reasoning: str = Field(description="Very short explanation of why this intent was chosen by the model.")

SYSTEM_PROMPT = """You are the core intent router for Ervis, a generic, autonomous, and self-evolving AI agent system.
Your goal is to accurately classify the user's input and provide a natural acknowledgment if the system is just recording information.

### CRITICAL RULES:
1. MANDATORY ACTION (EXECUTE_TOOL): If the user's sentence contains a clear ACTION or COMMAND using imperative verbs like "oluştur", "ekle", "aç", "kapat", "çalıştır", "hatırlat", "ayarla", "yaz", "göster", "kontrol et", or "listele", this MUST be classified as EXECUTE_TOOL.
2. LOG_ENTITY & ACKNOWLEDGMENT: If the intent is LOG_ENTITY, you MUST generate a `suggested_acknowledgment`. This acknowledgment should be warm, human-like, and specific to what the user said (e.g., if they say "saçım kumral", say "Tamamdır, saç renginin kumral olduğunu not ettim!"). Avoid robotic phrases like "sisteme kaydedildi".
3. QUERY_KNOWLEDGE: If the user asks about facts or past events, it is QUERY_KNOWLEDGE.
4. GENERAL_CHAT: If the user is just greeting or chatting, providing a friendly acknowledgment.

Categories:
- EXECUTE_TOOL: The user wants the system to DO something.
- LOG_ENTITY: The user is providing a fact or event for Ervis to remember.
- QUERY_KNOWLEDGE: The user is asking about previously stored information.
- GENERAL_CHAT: Simple greetings or social talk.
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
