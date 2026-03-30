import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
import json
import re

import requests
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

def _resolve_user_now(metadata: Optional[Dict]) -> tuple[datetime, str]:
    tz_name = (metadata or {}).get("timezone")
    try:
        if tz_name:
            tz = ZoneInfo(tz_name)
            return datetime.now(tz), tz_name
    except Exception:
        pass
    return datetime.now(), "server-local"

def _detect_target_date(user_query: str, now: datetime) -> Optional[str]:
    q = user_query.lower()
    if "yarın" in q or "tomorrow" in q:
        return (now + timedelta(days=1)).date().isoformat()
    if "bugün" in q or "today" in q:
        return now.date().isoformat()
    if "dün" in q or "yesterday" in q:
        return (now - timedelta(days=1)).date().isoformat()
    return None

def _is_sports_schedule_query(user_query: str) -> bool:
    q = user_query.lower()
    keywords = ["maç", "mac", "fikstür", "kiminle oyn", "oynayacak", "rakip", "match", "fixture"]
    return any(k in q for k in keywords)

def _is_turkiye_query(user_query: str) -> bool:
    q = user_query.lower()
    return any(k in q for k in ["türkiye", "turkiye", "turkey"])

def _parse_espn_fixture_payload(html: str) -> Optional[Dict]:
    m = re.search(r"window\['__espnfitt__'\]\s*=\s*(\{.*?\});</script>", html, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception:
        return None

def _fetch_turkiye_fixtures_from_espn(timeout: int = 20) -> List[Dict]:
    """
    Deterministic fixture source for Türkiye national team (ESPN team id 465).
    """
    url = "https://www.espn.com/soccer/team/fixtures/_/id/465/turkiye"
    resp = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
    resp.raise_for_status()
    payload = _parse_espn_fixture_payload(resp.text)
    if not payload:
        return []
    return payload.get("page", {}).get("content", {}).get("fixtures", {}).get("events", []) or []

def _event_iso_date(event: Dict, tz_name: str) -> Optional[str]:
    date_str = event.get("date")
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        tz = ZoneInfo(tz_name) if tz_name and tz_name != "server-local" else None
        if tz:
            dt = dt.astimezone(tz)
        return dt.date().isoformat()
    except Exception:
        return date_str[:10] if len(date_str) >= 10 else None

def _format_espn_match_context(event: Dict, tz_name: str, target_date: str) -> str:
    comps = event.get("competitors") or []
    names = [c.get("displayName", "") for c in comps]
    matchup = " vs ".join([n for n in names if n]) or (event.get("name") or "Bilinmeyen eşleşme")
    league = event.get("league", "Bilinmeyen turnuva")
    detail = (event.get("status") or {}).get("detail", "")
    link = "https://www.espn.com" + (event.get("link") or "")
    local_date = _event_iso_date(event, tz_name) or target_date
    return (
        f"[KAYNAK:ESPN-FIXTURE]\n"
        f"target_date={target_date} timezone={tz_name}\n"
        f"match_date={local_date}\n"
        f"eşleşme={matchup}\n"
        f"turnuva={league}\n"
        f"detay={detail}\n"
        f"link={link}"
    )

def _format_espn_no_match_context(target_date: str, tz_name: str, next_event: Optional[Dict]) -> str:
    if next_event:
        comps = next_event.get("competitors") or []
        names = [c.get("displayName", "") for c in comps]
        matchup = " vs ".join([n for n in names if n]) or (next_event.get("name") or "Bilinmeyen eşleşme")
        next_date = _event_iso_date(next_event, tz_name) or "Bilinmiyor"
        league = next_event.get("league", "Bilinmeyen turnuva")
        detail = (next_event.get("status") or {}).get("detail", "")
        link = "https://www.espn.com" + (next_event.get("link") or "")
        return (
            f"[KAYNAK:ESPN-FIXTURE-NO-MATCH]\n"
            f"target_date={target_date} timezone={tz_name}\n"
            f"status=NO_MATCH_ON_TARGET_DATE\n"
            f"next_match_date={next_date}\n"
            f"next_match={matchup}\n"
            f"next_match_league={league}\n"
            f"next_match_detail={detail}\n"
            f"next_match_link={link}"
        )
    return (
        f"[KAYNAK:ESPN-FIXTURE-NO-MATCH]\n"
        f"target_date={target_date} timezone={tz_name}\n"
        f"status=NO_MATCH_ON_TARGET_DATE\n"
        f"next_match_date=UNKNOWN"
    )

def _target_date_tokens(target_date: str) -> List[str]:
    year, month, day = target_date.split("-")
    return [
        target_date,
        f"{day}.{month}.{year}",
        f"{day}/{month}/{year}",
        f"{day}-{month}-{year}",
    ]

def _result_matches_target_date(result: Dict, tokens: List[str]) -> bool:
    blob = " ".join(
        [
            str(result.get("title", "")),
            str(result.get("body", "")),
            str(result.get("date", "")),
        ]
    ).lower()
    return any(t.lower() in blob for t in tokens)

def _is_trusted_sports_source(link: str) -> bool:
    if not link:
        return False
    host = (urlparse(link).netloc or "").lower()
    trusted = (
        "tff.org",
        "uefa.com",
        "fifa.com",
        "trtspor.com.tr",
        "ntvspor.net",
        "aspor.com.tr",
        "fanatik.com.tr",
    )
    return any(d in host for d in trusted)

async def refine_query(user_query: str, metadata: Optional[Dict] = None) -> str:
    """
    LLM as a Query Refiner: Adaptive and language-aware. 
    Determines if the query is local (Turkey/Turkish) or global.
    """
    try:
        now, tz_used = _resolve_user_now(metadata)
        current_date_tr = now.strftime("%d.%m.%Y")
        target_date = _detect_target_date(user_query, now)
        time_anchor = (
            f"NOW={now.strftime('%Y-%m-%d %H:%M:%S')}, TIMEZONE={tz_used}, TARGET_DATE={target_date or 'NONE'}"
        )
        
        client = get_openai_client()
        system_prompt = (
            "Sen bir Arama Motoru Uzmanı'sın. Kullanıcının sorusunu DuckDuckGo için en yüksek verimi "
            "alacak kısa ve öz anahtar kelimelere (keywords) dönüştür.\n"
            f"BUGÜNÜN TARİHİ: {current_date_tr}\n"
            f"ZAMAN ÇAPASI: {time_anchor}\n"
            "KURALLAR:\n"
            "1. Soru yerelse Türkçe, küreselse İngilizce anahtar kelimeler seç.\n"
            "2. 'dün', 'bugün', 'yarın' gibi ifadeleri kesinlikle YYYY-MM-DD tarihe çevir.\n"
            "3. HAVA DURUMU/GÜNCEL OLAYLAR: Eğer kullanıcı şehir belirtmemişse 'Türkiye geneli' veya 'Genel' ekle. "
            "Kullanıcının konumunu (BUGÜNÜN TARİHİ yanında yazan yer değilse bile) tahmin etmeye çalışma. "
            "4. Sadece sorguyu dön (Örn: 'Bugün hava nasıl' -> 'Türkiye geneli hava durumu 23.03.2026')."
        )
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Kullanıcı Sorusu: {user_query}\nMetadata: {metadata or {}}",
                }
            ],
            temperature=0.0
        )
        refined = response.choices[0].message.content.strip().replace('"', '')
        print(f"🔄 [REFINE] '{user_query}' -> '{refined}'")
        return refined
    except Exception as e:
        print(f"Refine error: {str(e)}")
        return user_query

async def filter_results(user_query: str, raw_results: List[Dict], target_date: Optional[str] = None) -> List[Dict]:
    """
    Semantic Filtering: Prunes irrelevant snippets or noise using LLM logic.
    """
    if not raw_results: return []
    try:
        client = get_openai_client()
        snippets = "\n".join([
            f"ID:{i} - DATE:{r.get('date', 'unknown')} - TITLE:{r.get('title', '')[:120]} - BODY:{r.get('body', '')[:220]}"
            for i, r in enumerate(raw_results)
        ])
        system_prompt = (
            "Aşağıdaki arama sonuçlarını (snippet) kullanıcının sorusuyla doğrudan veya dolaylı alaka bakımından değerlendir. "
            "Kullanıcının sorusuna cevap verebilecek veya ipucu içeren sonuçları seç. "
            f"Özel kural: hedef tarih {target_date or 'belirtilmedi'} ise tarihle uyumsuz sonuçları ele."
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

async def search_the_web(query: str, metadata: Optional[Dict] = None) -> str:
    """
    Simultaneously tries refined and raw queries to get the best result pool.
    """
    now, tz_used = _resolve_user_now(metadata)
    target_date = _detect_target_date(query, now)
    
    # Deterministic sports fixture adapter (Türkiye)
    if _is_sports_schedule_query(query) and _is_turkiye_query(query) and target_date:
        try:
            events = _fetch_turkiye_fixtures_from_espn()
            matches = [e for e in events if _event_iso_date(e, tz_used) == target_date]
            if matches:
                return _format_espn_match_context(matches[0], tz_used, target_date)
            future_events = sorted(
                [e for e in events if (_event_iso_date(e, tz_used) or "") > target_date],
                key=lambda e: _event_iso_date(e, tz_used) or "9999-12-31"
            )
            return _format_espn_no_match_context(target_date, tz_used, future_events[0] if future_events else None)
        except Exception as e:
            print(f"⚠️ [ESPN FIXTURE] Adapter failed, falling back to web search: {e}")

    search_query = await refine_query(query, metadata=metadata)
    
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
        filtered_results = await filter_results(query, raw_results, target_date=target_date)

        # Step 3: Deterministic verification for sports/fixture queries
        if _is_sports_schedule_query(query) and target_date:
            tokens = _target_date_tokens(target_date)
            verified_results = [
                r for r in filtered_results
                if _result_matches_target_date(r, tokens) and _is_trusted_sports_source(r.get("href", ""))
            ]
            if not verified_results:
                return (
                    f"[DOĞRULAMA BAŞARISIZ] Spor fikstürü için {target_date} tarihini doğrulayan güvenilir kaynak bulunamadı. "
                    "Kesin rakip bilgisi verilmemeli."
                )
            filtered_results = verified_results[:5]
            
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
            date_str = res.get('date', 'Bilinmiyor')
            formatted_results.append(f"{i}. {title}\nTarih: {date_str}\nÖzet: {snippet}\nKaynak: {link}")
            
        context_header = f"[ZAMAN ÇAPASI] now={now.isoformat()} timezone={tz_used} target_date={target_date or 'NONE'}"
        context_str = f"{context_header}\n\n" + "\n\n".join(formatted_results)
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
