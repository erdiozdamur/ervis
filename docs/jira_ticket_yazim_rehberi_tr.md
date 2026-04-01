# Jira Ticket Yazım Rehberi (TR)

## Neden "Bunu ilgili sisteme otomatik işleyemiyorum" denmiş olabilir?

Asistanlar çoğu zaman doğrudan Jira API erişimi olmadığı için güvenli tarafta kalıp "ben ticket'ı sisteme açamam, ama metni hazırlayabilirim" şeklinde bir ifade kullanır.

Bu ifade teknik olarak yanlış değildir; ancak kullanıcı sadece ticket metni istiyorsa gereksiz ve akışı bozan bir ön cümle olabilir.

## Yazım/Kalite Notu

- Kullanıcının yazım hatalarını mümkün olduğunda niyeti koruyarak normalize etmek gerekir.
- Bu örnekte "ker kategorisi" ifadesi bağlama göre büyük olasılıkla "her kategori" olmalıydı.

## Önerilen Jira İçeriği

**Başlık**
Intranet Otel Olanakları Sayfası: Kategoriler Varsayılan Açık + Kategori Başına Maks. 3 Seçim

**Açıklama**
Intranet üzerindeki **Otel Olanakları** sayfasında aşağıdaki davranış güncellemeleri istenmektedir:

1. Kategori panelleri sayfa açıldığında **varsayılan olarak açık** gelmelidir.
2. **Her kategoride** kullanıcı en fazla **3 seçim** yapabilmelidir.

> Not: Önceki metinde geçen "ker kategorisi" ifadesi yazım hatasıdır; "her kategoride" olarak değerlendirilmiştir.

**Kabul Kriterleri (Acceptance Criteria)**
- Sayfa ilk yüklendiğinde tüm kategori başlıkları açık görünür.
- Bir kategori içinde 3 seçim yapıldıktan sonra:
  - 4. seçenek işaretlenemez.
  - Kullanıcıya anlaşılır bir uyarı mesajı gösterilir (örn. "Bu kategoride en fazla 3 seçim yapabilirsiniz.").
- Kullanıcı seçili öğelerden birini kaldırdığında tekrar seçim yapılabilir.
- Kısıt **kategori bazında** uygulanır; bir kategorideki limit diğer kategorileri etkilemez.
- Mevcut filtreleme/kaydetme akışı bozulmaz.

**Teknik Notlar**
- Varsayılan açık durum için kategori accordion/collapse bileşeninin initial state'i güncellenmeli.
- Maksimum seçim kontrolü UI seviyesinde ve mümkünse backend doğrulamasıyla desteklenmeli.

**Test Senaryoları**
- Sayfa açılışında tüm kategorilerin açık geldiği doğrulanır.
- Tek bir kategoride art arda 4 seçim denenir; 4. seçim engellenir.
- 3 seçim sonrası bir seçim kaldırılır, yeni seçim yapılabildiği doğrulanır.
- Farklı kategorilerde bağımsız olarak 3'er seçim yapılabildiği doğrulanır.

**Öncelik**
Yüksek

**Etiketler**
intranet, otel-olanaklari, ux, validasyon
