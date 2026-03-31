# Hafıza Kalitesi Analizi ve İyileştirme Alanları

## Kısa Özet
Mevcut mimari, bilgi çıkarmayı çalıştırıyor ancak detay seviyesinin düşük kalmasına yol açan birkaç temel sınırlama var:
- Gözlemci ajan sadece kısa keyword listesi üretip saklıyor; cümle düzeyi kanıt/metin kaydı yok.
- Varlık eşleştirme sadece `name + entity_type` ile yapılıyor; eş anlamlı/normalizasyon yok.
- Geri getirme (retrieval) katmanı keyword eşleşmesine dayanıyor; semantik arama veya sıralama skoru yok.
- Güven, kaynak, zaman ve konuşma bağlamı alanları yetersiz olduğu için bellek “neden böyle kaydedildi” sorusunu cevaplayamıyor.

## Tespitler (Kod Bazlı)

### 1) Pasif gözlemci, ayrıntıyı kaybediyor
- `passive_memory_observation`, LLM’den yalnızca virgülle ayrılmış anahtar kelimeler istiyor.
- Sonuçta “kanıt cümlesi”, “hangi mesajdan geldi”, “kesinlik puanı”, “zaman damgası” gibi kalite artırıcı metadata kayboluyor.
- Ayrıca relation attribute içine sadece `query[:50]` yazılması, kaynağı çok kırpıyor.

**Etkisi:** Kullanıcı “ben bunu ne zaman/nerede demiştim” veya “neden böyle anladın” sorularında sistem zayıf kalır.

### 2) Şema, detaylı bellek için sınırlı
- `entities.attributes` ve `relations.attributes` JSONB olsa da zorunlu kalite alanları şema seviyesinde garanti edilmiyor.
- Aşağıdaki alanlar standart değil: `confidence_score`, `source_message_id`, `evidence_span`, `last_confirmed_at`, `supersedes_entity_id`, `negated`.

**Etkisi:** Aynı bilginin farklı versiyonları birikiyor, güncel/doğru olanı seçmek zorlaşıyor.

### 3) Çıkarım güncelleme stratejisi “append/update” odaklı
- `store_knowledge` mevcut entity varsa attributes’u `update()` ile birleştiriyor.
- Bu yaklaşım çelişkili bilgileri yönetmiyor (ör. eski meslek vs yeni meslek).
- “Bellek çözünürlüğü” yok: doğrulanmış, tahmini, geçmişte kalmış, iptal edilmiş bilgi ayrımı yapılmıyor.

**Etkisi:** Zamanla gürültü birikiyor, model yanlış veya eski detayları tekrar etmeye başlıyor.

### 4) Retrieval semantik değil, keyword tabanlı
- `retrieve_context` query string içinde entity adının geçmesine bakıyor.
- Eş anlamlılar, yazım farkları, dolaylı anlatımlar kaçırılıyor.
- Sonra “en son 5 entity” fallback’iyle bağlam şişebiliyor.

**Etkisi:** İlgili ama adı geçmeyen detaylar kaçıyor; ilgisiz detaylar bağlama giriyor.

### 5) Relation çekimi kapsamlı ama seçici değil
- Seçilen entity’lerin tüm ilişkileri toplanıyor, sonra düz metin halinde prompt’a dökülüyor.
- Relevance ranking, type filtering ve token bütçesi yönetimi yok.

**Etkisi:** Prompt kalabalıklaşıyor; kritik bilgi sinyali düşüyor.

### 6) “Profil” temsili tek düğümle basitleştirilmiş
- `Kullanıcı Profili` entity’si pratik ama çok farklı kavramlar aynı merkeze bağlanıyor.
- Kimlik/rol, tercih, hedef, alışkanlık gibi boyutlar ayrışmadığı için sorgulanabilirlik azalıyor.

**Etkisi:** “Detaylı ama düzenli” profil yerine “tek sepette toplanmış” bellek oluşuyor.

## İyileştirme Alanları (Öncelikli Yol Haritası)

## P0 (En kritik, 1-2 sprint)
1. **Yapısal çıkarım formatını zenginleştirin**
   - Keyword yerine JSON şema:
     - `fact`
     - `entity_type`
     - `confidence_score` (0-1)
     - `evidence_text`
     - `source_message_id`
     - `observed_at`
     - `fact_status` (`confirmed|inferred|negated|outdated`)
2. **Mesaj referansı zorunlu olsun**
   - Her entity/relation kaydı bir veya daha fazla `chat_messages.id` ile bağlansın.
3. **Çelişki yönetimi ekleyin**
   - Yeni bilgi eskisiyle çelişiyorsa eski kaydı `outdated` yapın, versiyon zinciri tutun.
4. **Retrieval’de karma strateji**
   - Keyword + embedding benzerliği + recency + confidence ile skorlayın.

## P1 (Kalite ve ölçek, 2-4 sprint)
1. **Ontoloji sadeleştirme ve zorunlu alanlar**
   - `Role`, `Interest`, `Goal`, `Project`, `Preference`, `Constraint` gibi tipleri netleştirin.
2. **Entity normalization**
   - Lowercase/lemma/alias/synonym tablosu ekleyin (`PO` = `Product Owner`).
3. **Relation relevance filtering**
   - Cevaplanan niyete göre relation type whitelist uygulayın.
4. **Bellek sıkıştırma (memory consolidation)**
   - Haftalık job: tekrarları birleştir, stale kayıtları düşür, özet üret.

## P2 (Gelişmiş güvenilirlik)
1. **Kullanıcı onayı döngüsü**
   - “Senden şunu anladım, doğru mu?” mikro doğrulamalar.
2. **Kalite metrikleri dashboard’u**
   - Precision@k, contradiction rate, stale fact ratio.
3. **A/B test**
   - Eski retrieval vs hibrit retrieval karşılaştırması.

## Örnek Teknik Uygulamalar

### A) Yeni tablo önerisi: `memory_facts`
- `id`, `user_id`, `entity_id`, `relation_id`, `fact_text`, `fact_status`, `confidence_score`, `source_message_id`, `evidence_text`, `observed_at`, `last_confirmed_at`.

### B) Retrieval skoru
- `score = 0.45 * semantic_similarity + 0.25 * keyword_overlap + 0.20 * confidence_score + 0.10 * recency_decay`

### C) Prompt’a ham dump yerine katmanlı context
- `Identity block`
- `Stable preferences`
- `Active goals`
- `Recent updates (last 14 days)`
- `Conflicts/uncertainties`

## Hızlı Kazanımlar (Bu hafta yapılabilir)
1. Pasif gözlemciyi keyword yerine JSON çıktıya geçirmek.
2. `query[:50]` yerine tam kanıt metni + message_id saklamak.
3. Retrieval’de “en son 5 entity” fallback’ini skor tabanlı fallback ile değiştirmek.
4. Prompt’a girecek context’i max N kayıt ve relevance sırası ile sınırlamak.

## Beklenen Sonuç
Bu iyileştirmelerle sistem:
- Daha **detaylı**, **izlenebilir** ve **açıklanabilir** hafıza tutar.
- Eski/çelişkili bilgiyi daha iyi yönetir.
- Kullanıcının yazdıklarıyla daha doğru bağ kurar ve cevap kalitesi artar.
