import os
from typing import List, Dict, Optional
from ddgs import DDGS
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv(override=True)
_client: Optional[AsyncOpenAI] = None

def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is missing.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

async def refine_query(user_query: str) -> str:
    """
    LLM as a Query Refiner: Adaptive and language-aware. 
    Determines if the query is local (Turkey/Turkish) or global.
    """
    try:
        from datetime import datetime
        # Local Turkish date for local queries
        current_date_tr = datetime.now().strftime("%d %m %Y") # Use numbers to avoid locale issues
        
        client = get_openai_client()
        system_prompt = (
            "Sen bir Arama Motoru Uzmanı'sın. Kullanıcının sorusunu DuckDuckGo için en yüksek verimi "
            "alacak kısa ve öz anahtar kelimelere (keywords) dönüştür.\n"
            f"BUGÜNÜN TARİHİ: {current_date_tr}\n"
            "KURALLAR:\n"
            "1. Soru yerelse Türkçe, küreselse İngilizce anahtar kelimeler seç.\n"
            "2. 'dün', 'bugün' gibi ifadeler yerine tam tarih kullan.\n"
            "3. HAVA DURUMU/GÜNCEL OLAYLAR: Eğer kullanıcı şehir belirtmemişse 'Türkiye' veya 'Genel' ekle.\n"
            "4. Sadece sorguyu dön (Örn: 'Bugün hava nasıl' -> 'İstanbul hava durumu 16.03.2026')."
        )
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Kullanıcı Sorusu: {user_query}"}
            ],
            temperature=0.0
        )
        refined = response.choices[0].message.content.strip().replace('"', '')
        print(f"🔄 [REFINE] '{user_query}' -> '{refined}'")
        return refined
    except Exception as e:
        print(f"Refine error: {str(e)}")
        return user_query

async def filter_results(user_query: str, raw_results: List[Dict]) -> List[Dict]:
    """
    Semantic Filtering: Prunes irrelevant snippets or noise using LLM logic.
    """
    if not raw_results: return []
    try:
        client = get_openai_client()
        snippets = "\n".join([f"ID:{i} - {r.get('body', '')[:200]}" for i, r in enumerate(raw_results)])
        system_prompt = (
            "Aşağıdaki arama sonuçlarını (snippet) kullanıcının sorusuyla doğrudan veya dolaylı alaka bakımından değerlendir. "
            "Kullanıcının sorusuna cevap verebilecek veya ipucu içeren sonuçları seç. "
            "Sadece seçilen ID'leri virgülle ayırarak dön (Örn: 0,2,3). Eğer hiç alakalı sonuç yoksa 'NONE' yaz."
        )
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Kullanıcı Sorusu: {user_query}\n\nSonuçlar:\n{snippets}"}
            ],
            temperature=0.0
        )
        content = response.choices[0].message.content.strip().upper()
        if content == "NONE":
            print(f"🧹 [FILTER] Hiç alakalı sonuç bulunamadı.")
            return []
            
        relevant_ids = [id.strip() for id in content.split(",") if id.strip().isdigit()]
        filtered = [raw_results[int(id)] for id in relevant_ids if int(id) < len(raw_results)]
        print(f"🧹 [FILTER] {len(raw_results)} -> {len(filtered)} alakalı sonuç seçildi.")
        return filtered
    except Exception as e:
        print(f"Filter error: {str(e)}")
        return raw_results[:2]

async def search_the_web(query: str) -> str:
    """
    Simultaneously tries refined and raw queries to get the best result pool.
    """
    search_query = await refine_query(query)
    
    # We will try BOTH queries to ensure we don't miss anything due to over-refinement
    print(f"🔍 [WEB SEARCH] Original: '{query}' | Refined: '{search_query}'")
    try:
        raw_results = []
        with DDGS() as ddgs:
            # Try refined query
            refined_results = list(ddgs.text(search_query, max_results=5))
            raw_results.extend(refined_results)
            
            # Also try raw query as safety net
            original_results = list(ddgs.text(query, max_results=5))
            # Dedup and extend (based on href/link)
            existing_links = {r.get('href') for r in raw_results}
            for res in original_results:
                if res.get('href') not in existing_links:
                    raw_results.append(res)

        # Step 2: Semantic Filtering
        filtered_results = await filter_results(query, raw_results)
            
        if not filtered_results:
            if raw_results:
                print("⚠️ [WEB SEARCH] Filtering too aggressive, using top 3.")
                filtered_results = raw_results[:3]
            else:
                return "İnternet aramasından herhangi bir sonuç dönmedi."
            
        formatted_results = []
        for i, res in enumerate(filtered_results, 1):
            title = res.get('title', 'Başlık Yok')
            snippet = res.get('body', 'Özet Yok')
            link = res.get('href', '')
            formatted_results.append(f"{i}. {title}\nÖzet: {snippet}\nKaynak: {link}")
            
        context_str = "\n\n".join(formatted_results)
        print(f"✅ [WEB SEARCH] {len(filtered_results)} sonuç bağlam olarak hazırlandı.")
        return context_str
        
    except Exception as e:
        print(f"❌ [WEB SEARCH] Hata: {str(e)}")
        return f"Arama sırasında bir hata oluştu: {str(e)}"

if __name__ == "__main__":
    # Simple test
    test_query = "Bugün İstanbul hava durumu"
    result = asyncio.run(search_the_web(test_query))
    print("\n--- Test Sonucu ---")
    print(result)
