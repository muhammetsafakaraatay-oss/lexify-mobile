# Lexify V2 — Tam Yol Haritası

> Bu doküman MVP sonrası 10 ana özelliğin sıralı geliştirme planıdır. Her faz bir sonrakini kolaylaştıracak şekilde dizilmiştir. Tüm efor tahminleri tek geliştirici (sen) varsayımıyla yapılmıştır.

## Vizyon

**Lexify, "her gün açılan İngilizce yoldaşı" olacak.** Sözlük değil; pasif maruziyet + aktif üretim + sosyal motivasyon üçlüsünü tek döngüde birleştiren bir öğrenme platformu.

## Kuzey Yıldız Metrik

**Haftalık Aktif Kelime Etkileşimi (HAKE):** Bir kullanıcının haftada (a) yeni kaydettiği + (b) tekrar ettiği + (c) bir feature'da gördüğü kelime sayısı. 7 gün üst üste >0 olan kullanıcı = "alışkanlık kazanmış" segmenti.

## Faz Özeti

| Faz | Amaç | Süre | Özellikler |
|-----|------|------|------------|
| 0 | Altyapı | 1-2 hf | Event log, LLM wrapper, tema sınıflandırma |
| 1 | Retention | 3-4 hf | Bağlam Köprüleri, Lock Screen Widget, Mikro-Hikaye |
| 2 | Conversion (Pro) | 4-6 hf | Ters Quiz, Ses Günlüğü, Reading Coach |
| 3 | Viral / Büyüme | 4-5 hf | Wrapped, Düello, CEFR Pasaportu |
| 4 | İçerik Genişleme | 2-3 hf | Podcast/Şarkı modu |

Toplam: ~14-20 hafta (yarı zamanlı çalışırsan ~5-6 ay)

---

# FAZ 0 — Altyapı

Bu faz görünmez ama her şeyi belirler. Atlama. Yarım yaparsan Faz 1'de yeniden yazarsın.

## 0.1 Zenginleştirilmiş Event Log

### Problem
Mevcut kelime kaydı muhtemelen `{word, translation, user_id, created_at}` formatında. Sonraki feature'lar için bu yeterli değil.

### Yeni şema (Supabase: `saved_words` tablosu)

```sql
ALTER TABLE saved_words ADD COLUMN IF NOT EXISTS
  source_url TEXT,
  source_type TEXT, -- 'article' | 'paste' | 'youtube' | 'ocr' | 'podcast'
  source_title TEXT,
  context_sentence TEXT,    -- kelimenin geçtiği tam cümle
  context_paragraph TEXT,   -- üst paragraf (Reading Coach için)
  cefr_level TEXT,          -- 'A1'..'C2'
  topic_tags TEXT[],        -- ['technology', 'politics', ...]
  ipa TEXT,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  -- SM-2 alanları zaten var varsayımı
  last_seen_in_reading_at TIMESTAMPTZ; -- Bağlam Köprüleri için
```

Misafir kullanıcı için AsyncStorage'da aynı şemayı tut. `localWords.ts` ve `wordsService.ts` (veya benzeri) içinde sync layer'da iki taraf da bu alanları kabul etmeli.

### Yapılacaklar
- Migration SQL yaz, Supabase'de uygula
- TypeScript tipi güncelle (`types/Word.ts` veya benzeri)
- Kaydetme akışında (article reader → save word) tüm alanları doldur
- Backfill scripti: mevcut kelimeler için `source_type='legacy'`, diğer alanlar null

### Başarı kriteri
Son 100 yeni kayıtta `context_sentence` ve `source_type` 100% dolu.

---

## 0.2 LLM Wrapper Katmanı

### Problem
Bağlam Köprüleri, Hikaye, Reading Coach, Ses Günlüğü, Wrapped — hepsi LLM çağrısı yapacak. Her birinde fetch + retry + cache + cost log yazmak ölüm.

### Tasarım

`lib/ai/llmClient.ts` (yeni dosya):

```typescript
type LLMRequest = {
  feature: 'context_bridge' | 'micro_story' | 'reading_coach' | 'voice_feedback' | 'wrapped' | 'reverse_quiz' | 'topic_classify';
  model: 'gpt-4o-mini' | 'gpt-4o' | 'claude-haiku' | ...;
  messages: Message[];
  cacheKey?: string;        // varsa cache'den döner
  cacheTTL?: number;        // saniye
  maxRetries?: number;
  userId: string;
};

async function callLLM(req: LLMRequest): Promise<LLMResponse>;
```

Tek bir yerden:
- Supabase'de `ai_calls` tablosuna log (feature, tokens_in, tokens_out, cost_estimate, latency, success)
- Cache: AsyncStorage + Supabase'de paylaşılan (örn. Mikro-Hikaye haftalık → cache 7 gün)
- Retry: exponential backoff
- Rate limit: kullanıcı başı saatlik tavan (Pro/Free farkı)

### Sağlayıcı seçimi
İlk versiyonda OpenAI `gpt-4o-mini` yeterli (ucuz, hızlı, çoğu görev için). Voice feedback için Whisper. İleride model_router eklersin.

### Maliyet kontrolü
Free kullanıcıya günde toplam 20 LLM çağrısı tavanı (tüm feature'lar dahil). Pro: 200/gün. Tavanı `Settings → Kullanım` ekranında göster (transparency = güven).

### Yapılacaklar
- `lib/ai/llmClient.ts` yaz
- Supabase'de `ai_calls`, `ai_cache` tabloları
- `.env` örneğine `EXPO_PUBLIC_OPENAI_PROXY_URL` ekle (anahtar client'ta tutulmaz — `proxy.js`'in benzeri bir endpoint)
- Tüm feature'lar bu wrapper'ı kullanmak zorunda — README'ye yaz

### Başarı kriteri
Bir feature 3 satırla LLM çağırabilir, log otomatik, hata → kullanıcıya nazik mesaj.

---

## 0.3 Kelime Tema Sınıflandırması

### Problem
Wrapped "En sevdiğin tema teknoloji" diyecekse, Reading Coach "bu makalenin temasına uygun kelimeler" önerecekse, her kelimenin temaya bağlanması lazım.

### Çözüm
Kelime kaydedildiği anda asenkron job:
1. Cümle bağlamından LLM ile 1-3 tema etiketi: `['technology', 'business', 'science', 'politics', 'sports', 'culture', 'health', 'environment', 'lifestyle', 'general']`
2. `topic_tags` alanına yaz

Cache stratejisi: aynı cümle hash'i → aynı sonuç (LLM çağrısı bir kez).

### Prompt taslağı
```
You are a content classifier. Given an English sentence and a target word, return 1-3 topic tags from this fixed list:
[technology, business, science, politics, sports, culture, health, environment, lifestyle, general]

Sentence: "{context_sentence}"
Target word: "{word}"

Return JSON: {"tags": ["..."]}
```

### Yapılacaklar
- Background queue (Supabase Edge Function veya sadece kayıt sonrası fire-and-forget)
- Geriye dönük: mevcut kelimeleri batch'le sınıflandır (tek seferlik script)

### Başarı kriteri
Yeni kayıtların %95'i 60 saniye içinde tag almış.

---

# FAZ 1 — Pasif Maruziyet (Retention)

Amaç: Uygulamayı "her gün açılan" hale getirmek. Kullanıcı aktif olarak çalışmaya gelmese bile maruz kalsın.

## 1.1 Bağlam Köprüleri (#1)

### Tek cümle değer önerisi
Kaydettiğin kelime, sonradan okuduğun makalede karşına çıktığında parlasın — "öğrendiğin kelime burada yaşıyor" hissi.

### Kullanıcı problemi
Kullanıcı kelime kaydeder, sonra unutur. SM-2 hatırlatır ama "kaydettiğim kelimeler hayatımda nerede?" sorusu yanıtsız kalır.

### Çözüm
Article Reader'da metin render edilirken, kullanıcının `saved_words` listesindeki kelimelerle eşleşen tokenlar hafif sarı bir alt çizgi / arka plan ile vurgulanır. Üstüne dokunulduğunda mini popup: "Bu kelimeyi 12 gün önce X makalesinden kaydetmiştin. Anlamı: ... Tekrar etmek ister misin?"

### Kullanıcı akışı
1. Kullanıcı Keşfet'ten yeni bir BBC makalesi açar
2. Reader paragrafları render ederken her token kontrol edilir: kullanıcının saved_words setinde var mı?
3. Eşleşen tokenlar `<HighlightedWord>` komponenti ile sarılır
4. Dokunma → mini bottom sheet: kelime + ilk kaydedildiği bağlam + "Şimdi tekrar et" butonu
5. "Şimdi tekrar et" → SM-2'de o kelimenin sırasını öne çek + 1 quick review kartı göster

### Ekranlar / UI değişiklikleri
- `components/reader/Paragraph.tsx` (veya benzeri): tokenize edip eşleştirme
- Yeni: `components/reader/HighlightedWord.tsx`
- Yeni: `components/reader/WordReunionSheet.tsx` (mini bottom sheet)

### Teknik gereksinimler
- **Eşleştirme:** Lemmatization şart. "running" kaydettiyse "ran"da da parlamalı.
  - Hafif çözüm: client-side basit suffix stemming (`-ing`, `-ed`, `-s`, `-es`)
  - İyi çözüm: lemmatized form'u da `saved_words.lemma` olarak sakla, eşleştirme lemma üzerinden
- **Performans:** Set lookup O(1). Word listesi >500 olabilir → JS Set kullan, paragraf başına yeniden hesaplama yok.
- **False positive:** "I am" cümlesinde "am" kelimesini parlatma. Min 3 harf + stopword listesi filtresi.

### Edge case'ler
- Aynı kelime aynı makalede 8 kez geçiyorsa: sadece **ilki** parlasın, gerisi normal. (Görsel kirlilik önleme.)
- Kullanıcı highlighted kelimeye dokunup mini sheet'ten "Bunu tekrar gösterme" derse → o kelime 7 gün suppress.
- Misafir → giriş yapınca merge sonrası eşleşmeler doğal olarak çoğalır.

### AI kullanımı
Bu feature **AI'sız** çalışır. Sadece string eşleştirme. Bu yüzden Faz 1'in en ucuz feature'ı.

### Başarı metrikleri
- Highlighted word'e dokunma oranı (gösterim başına)
- "Şimdi tekrar et" CTA tıklama oranı
- HAKE'de artış (özellikle aktif kelime sayısı)

### Tahmini efor
**M (Medium)** — 5-7 gün.

### Pro/Free
İkisinde de aktif. Pro farkı yok. (Retention feature'ı — herkesin alışkanlık kazanması işine yarar.)

---

## 1.2 Lock Screen Widget (#7)

### Tek cümle değer önerisi
İPhone'unu her açtığında bir kelimenle karşılaş.

### Kullanıcı problemi
Uygulamayı açmadıkça kelimelere maruz kalmıyor. SM-2 bildirim gönderiyor ama bildirimler bastırılıyor.

### Çözüm
iOS 16+ lock screen widget (küçük + orta boy) + ana ekran widget. WidgetKit + Expo'da `react-native-widget-extension` veya native modül.

### İçerik mantığı
Widget her ~30 dakikada bir yenilenir (iOS budgets dahilinde) ve gösterir:
- **Bugünün kelimesi** (eğer SM-2'de bugün tekrar gerekiyorsa o)
- Yoksa **rastgele kaydedilmiş kelime**
- Format: `serendipity` (büyük) + `/ˌsɛrənˈdɪpɪti/` (IPA) + Türkçe anlam (küçük) + 1 örnek cümle

Widget'a dokun → uygulama açılır → o kelimenin detayına git.

### Varyasyonlar
- **Küçük widget:** Sadece kelime + anlam
- **Orta widget:** Kelime + IPA + örnek cümle + "Tekrar et" butonu (Lock screen quick action)
- **Büyük widget:** 3 kelimeli mini liste

### Teknik gereksinimler
- **Veri kaynağı:** Widget native koddan AsyncStorage / shared App Group'a erişir
- iOS'ta App Group oluştur (`group.com.lexify.shared`)
- React Native tarafında kelime listesi seçimini güncelleyen background task: `expo-background-fetch` veya `expo-task-manager` ile günde 1-2 kez "widget data" payload'ını shared container'a yaz
- Native: WidgetKit Swift kodu (Expo prebuild ile `ios/` klasörüne ekle)

### Edge case'ler
- Hiç kelime kaydetmemiş kullanıcı → varsayılan "Lexify'a başla" mesajı + örnek kelime
- Veri 24 saatten eski → "Lexify'ı aç" CTA

### Başarı metrikleri
- Widget eklenmiş kullanıcı oranı (Settings → Widget rehberi)
- Widget üzerinden uygulamaya açılma sayısı (DAU katkısı)

### Tahmini efor
**L (Large)** — 10-14 gün. Native iOS gerektirir, ilk widget tecrüben olabilir.

### Pro/Free
İkisinde de. Pro farkı: Pro kullanıcı widget'ta "günün quiz'i" mini etkileşim görür (sonra eklersin).

---

## 1.3 Mikro-Hikaye Üretici (#4)

### Tek cümle değer önerisi
Kelimelerinden senin hikayen — haftalık AI üretim, kişisel bağlam, paylaşılabilir.

### Kullanıcı problemi
SM-2 tek tek kelime tekrarı yapıyor. Ama dil bağlam içinde yaşıyor. Kullanıcının kelimeleri birbiriyle konuşmuyor.

### Çözüm
Her Pazar sabahı, kullanıcının son 7 gün kaydettiği kelimelerden 5-8'ini seçip 80-120 kelimelik bir mini hikaye üret. Kelimeler **bold + dokunulabilir** (anlam popup'ı). Hikayeyi Türkçe özetiyle göster. "Beğendin mi?" feedback'i al.

### Kullanıcı akışı
1. Pazar 09:00 lokal saat: push notification "Bu haftaki hikayen hazır 📖"
2. Açar → yeni `/story/this-week` ekranı
3. Hikayeyi okur, kelimelere dokunabilir
4. Altta: "Bu hikayeyi okudum" (SM-2'de ilgili kelimelere boost), "Yeniden üret" (Pro), "Paylaş" (görsel kart export)
5. Tüm geçmiş hikayeler `/story/archive` altında

### Ekranlar
- Yeni tab veya Çalış sekmesinde bir bölüm: "Hikayem"
- `app/(tabs)/story/index.tsx`, `app/(tabs)/story/archive.tsx`

### AI Prompt'u

```
You are a creative writer. Write a short story (80-120 words) in English at CEFR level {avg_level} that naturally uses these target words: {word_list}.

Constraints:
- Use each target word exactly once
- The story should have a clear narrative arc (setup, tension, resolution)
- Tone: {tone} (rotate weekly: warm, mysterious, humorous, reflective)
- Mark target words in the output with **double asterisks**

Then provide a Turkish summary (2-3 sentences) of the story.

Return JSON:
{
  "title": "...",
  "story_en": "...",
  "summary_tr": "..."
}
```

### Edge case'ler
- 7 günde <3 kelime kaydetmiş → hikaye üretme, "daha çok kelime kaydet" mesajı
- Aynı kelime grubu daha önce kullanıldı → tone değiş, üret
- LLM kelimeyi atlarsa → validasyon, yeniden çağrı (max 2 deneme)
- Pro olmayan: haftada 1 hikaye sınırı. Pro: günde 1 hikaye üretebilir (kendi seçtiği kelimelerle).

### Paylaşım kartı
- 1080×1920 görsel (story uyumlu)
- Hikaye başlığı + 2 satır teaser + kelime sayısı + "Lexify"
- `react-native-view-shot` ile capture, Share API ile paylaş

### Başarı metrikleri
- Pazar bildirimi → açılma oranı
- Hikaye tamamlanma oranı (sona kadar scroll + en az 1 kelime dokunma)
- Paylaşım sayısı (viral kanal)

### Tahmini efor
**M (Medium)** — 7-10 gün.

### Pro/Free
- Free: haftada 1 (otomatik)
- Pro: günde 1 manuel üretim + tone seçimi + arşiv sınırsız

---

# FAZ 2 — Üretken Beceri (Pro Conversion)

Amaç: Pro'yu meşrulaştıracak ağır feature'lar. Tanımadan üretime geçiş.

## 2.1 Ters Quiz (#9)

### Tek cümle değer önerisi
Türkçe görüp İngilizce yazabiliyor musun? Asıl test budur.

### Kullanıcı problemi
Mevcut quiz tanıma odaklı (EN→TR eşleştirme). Aktif üretim becerisi (yazma) test edilmiyor.

### Çözüm
Yeni quiz modu: "Çeviri Modu". TR cümle ver, kullanıcı EN'e çevirsin. AI puanlar + iyileştirme önerir.

### Kullanıcı akışı
1. Çalış sekmesi → "Çeviri Modu" kart
2. Ekranda: "_O an şehirde kimse yoktu, bu garip bir tesadüftü._"
   - Hedef kelime altta: **serendipity** (kullanmak zorunlu)
3. Kullanıcı text input'a İngilizce yazar
4. "Gönder" → AI puanlar (0-100) + 3 boyutta feedback:
   - Anlamsal doğruluk
   - Gramer
   - Hedef kelime doğru kullanılmış mı
5. Önerilen çeviri gösterilir (1-2 alternatif)
6. Kullanıcı "Tekrar dene" veya "Sonraki"

### AI Prompt'u

```
You are an English teacher evaluating a translation from Turkish to English.

Turkish source: "{tr_sentence}"
Target vocabulary word that must be used: "{word}"
Student's translation: "{user_answer}"

Evaluate on:
1. Semantic accuracy (0-40): Does it convey the meaning?
2. Grammar (0-30): Verb tenses, articles, prepositions, word order
3. Target word usage (0-30): Was the target word used correctly?

Return JSON:
{
  "scores": {"semantic": 0, "grammar": 0, "word_usage": 0},
  "total": 0,
  "feedback_tr": "Kısa açıklama Türkçe, 2-3 cümle",
  "suggested_translations": ["...", "..."],
  "highlighted_errors": [{"text": "...", "issue": "..."}]
}
```

### Edge case'ler
- Kullanıcı çok kısa cevap (1-2 kelime) → "Tam cümle yaz" uyarı
- Hedef kelimeyi hiç kullanmamış → otomatik 0 word_usage
- LLM puan tutarsızlığı → aynı cevap için sabit seed kullan (deterministik)
- Offline → uyarı, sırada bekleyen kuyruğa ekle

### Cümle havuzu
- Her kelime için 3-5 TR cümle önceden üretilmiş olmalı (cache). Kullanıcı kelimeyi kaydedince background'da Faz 0 wrapper'ı bu cümleleri üretir, `word_translation_prompts` tablosunda saklar.
- Aynı kelime için her seferinde farklı cümle göster.

### Başarı metrikleri
- Çeviri Modu oturum süresi
- Ortalama skor zaman içinde (gelişim göstergesi)
- Pro conversion: paywall'ı tetikleyen feature olarak ölç

### Tahmini efor
**M (Medium)** — 8-10 gün.

### Pro/Free
- Free: günde 3 çeviri
- Pro: sınırsız + "Zayıf olduğun kelimeler" otomatik seçim modu

---

## 2.2 Ses Günlüğü (Voice Echo) (#2)

### Tek cümle değer önerisi
Kelimelerini kendi sesinle kullan; telaffuzun ve grameri için AI koçun.

### Kullanıcı problemi
Yazılı üretim var (Ters Quiz). Ama dilin %40'ı konuşma. Telaffuz hiç çalışılmıyor.

### Çözüm
Haftada 1 (free) / her gün (Pro): kullanıcıya 3-5 kelimesinden bir prompt verilir, 30 saniyelik ses kaydı yapması istenir. Whisper transcribe → LLM analiz → telaffuz + gramer + kelime kullanımı feedback'i.

### Kullanıcı akışı
1. Çalış → "Sesli Pratik"
2. Prompt görünür: "Şu 4 kelimeyi kullanarak 30 saniyelik bir gün anlatımı yap: **opportunity**, **deliberate**, **fortunate**, **commute**"
3. Büyük kayıt butonu, 30 saniye geri sayım
4. Kayıt biter → "Analiz ediliyor..." (Whisper + LLM)
5. Sonuç ekranı:
   - Transcript (kelime kelime)
   - Hedef kelimelerin gerçekten geçip geçmediği checklist
   - Telaffuz puanı (Whisper confidence + ek model)
   - Gramer feedback'i: "of the" yerine "the" demişsin gibi
   - Akıcılık (kelime/saniye)
6. "Yeniden kaydet" veya "Kaydı sakla" (Pro: kayıt arşivi)

### AI Pipeline
1. **Whisper API** (OpenAI veya yerel `whisper.cpp`) → transcript + word-level timestamps
2. **LLM analiz** (gpt-4o-mini):
```
You are an English speaking coach.
Target words to use: {word_list}
Student's transcript: "{transcript}"
Audio duration: {seconds}s
Words per minute: {wpm}

Evaluate:
1. Were all target words used? (with timestamps)
2. Grammar issues (top 3, with corrections)
3. Sentence structure feedback
4. Was the speech coherent?

Return JSON: {...}
```
3. Telaffuz: Whisper'ın `avg_logprob` skoru her kelime için → kelime başına confidence. Düşük olanlar "telaffuz çalış" listesine eklenir.

### Edge case'ler
- Sessizlik / gürültü → "Mikrofona daha yakın konuş, tekrar dene"
- Kullanıcı Türkçe konuştu → tespit edilirse "Lütfen İngilizce konuş"
- 30 saniyeden kısa → kabul et ama "daha uzun konuşursan daha iyi feedback alırsın"
- Mikrofon izni reddi → ayarlar yönlendirme

### Teknik gereksinimler
- `expo-av` ile kayıt (m4a, 16kHz)
- Backend proxy üzerinden Whisper API (anahtar saklanmaz)
- Kayıt boyutu max ~500KB / 30 sn → upload makul

### Başarı metrikleri
- Sesli pratik tamamlama oranı
- Pro conversion (free hak biten kullanıcı paywall)
- Haftalık aktif konuşan kullanıcı sayısı

### Tahmini efor
**XL (Extra Large)** — 14-18 gün. Whisper entegrasyonu + kayıt UX + analiz pipeline + arşiv.

### Pro/Free
- Free: haftada 1 sesli pratik, kayıt saklanmaz
- Pro: günde 1 + arşiv + zaman içinde ilerleme grafiği (telaffuz puanı trendi)

---

## 2.3 Reading Coach (#6)

### Tek cümle değer önerisi
Makaleyi açmadan önce, "bu makaleyi anlamak için bunları bilmen yeterli" diyen bir koç.

### Kullanıcı problemi
Kullanıcı bir makaleye girince bilmediği kelime denizinde boğuluyor. Hangileri önemli? Hangileri atlanabilir?

### Çözüm
Makale açılmadan önce (preview ekranında) AI, kullanıcının CEFR seviyesinin **1 üstündeki** ve **anlam için kritik** 3-5 kelimeyi seçer ve sunar: "Şu kelimeleri öğrenirsen bu makaleyi rahatça okursun."

Kullanıcı "Hepsini kaydet ve oku" → kelimeler önceden kaydedilir, sonra okumaya başlar. Okurken zaten Bağlam Köprüleri (Faz 1.1) bunları parlatır.

### Kullanıcı akışı
1. Keşfet'te makale kart'ına tıkla
2. Açılır ön-ekran:
   - Makale başlığı + 2 satır özet
   - "📚 Bu makale için 4 kelime önerilir"
   - Liste: `mitigate`, `unprecedented`, `pivotal`, `ramification` (her biri TR anlamı + CEFR + örnek)
   - Butonlar: "Hepsini kaydet ve oku" | "Sadece oku" | "Hepsini biliyorum"
3. Seçim → reader açılır
4. Okuma sonu: "Önerilen kelimelerin kaçını kullandın?" mini feedback

### AI Prompt'u
```
You are a reading comprehension advisor for an English learner.

Learner CEFR level: {user_cefr}
Article text: """{article_text}"""

Identify 3-5 vocabulary words from the article that:
1. Are at CEFR level {user_cefr + 1} or {user_cefr + 2}
2. Are critical to understanding the main argument (not decorative)
3. The learner likely doesn't know (not in {user_known_words})

For each word, provide:
- The word (base form)
- CEFR level
- Turkish meaning
- The sentence where it appears in the article

Return JSON: {"recommended_words": [...]}
```

### Edge case'ler
- Makale çok kısa (<200 kelime) → "Bu makale için önerme yok, hadi oku"
- LLM 5+ döndürür → ilk 5'i al
- Kullanıcı CEFR'i set etmemiş → onboarding'de hızlı seviye tespit testi (5 soru)
- Pro olmayan günde 5 makalede coach kullanabilir

### CEFR seviyesi nasıl belirleniyor?
Onboarding'de mini test (10 kelime gösterilir, hangilerini biliyorsun) → seviye tahmini. Sonra otomatik: kullanıcının kaydettiği kelimelerin CEFR ortalaması → seviye dinamik güncellenir.

### Başarı metrikleri
- Coach gösterimi → makale tamamlama oranı (without coach baseline ile karşılaştır)
- "Hepsini kaydet ve oku" tıklama oranı
- Önerilen kelimeden kaçı sonradan SM-2'de "biliyorum" olarak işaretlendi

### Tahmini efor
**M (Medium)** — 7-9 gün. Asıl iş prompt iyileştirme ve CEFR tespiti.

### Pro/Free
- Free: günde 2 makalede coach
- Pro: sınırsız + "kişisel zorluk ayarı" (challenge mode: seviyenin 2 üstü kelimeler)

---

# FAZ 3 — Sosyal & Viral (Büyüme)

Amaç: Kullanıcı kazanım maliyetini düşür. Var olan kullanıcılar yeni kullanıcı getirsin.

## 3.1 Wrapped — Haftalık Özet (#3)

### Tek cümle değer önerisi
Spotify Wrapped tarzı, paylaşılabilir, "bu haftaki dil yolculuğun".

### Kullanıcı problemi
İlerleme görünmez. Kullanıcı ne kadar yol kat ettiğini hissetmiyor → motivasyon düşüyor → churn.

### Çözüm
Her Pazar 20:00 lokal: push "Bu haftaki Wrapped'in hazır 🎁" → animasyonlu story-style görsel akışı (5-7 kart).

### Kart akışı
1. **Hoş geldin:** "Bu hafta Lexify'da neler yaptın?"
2. **Sayılar:** "47 kelime kaydettin, 12 tekrar oturumu tamamladın"
3. **En sevdiğin tema:** "Bu hafta en çok **teknoloji** okudun (%41)"
4. **Yıldız kelimen:** "En zorlu kelimen: **ramification** — 4 denemede öğrendin"
5. **Seviye atlama:** "B1'in %78'indesin (geçen hafta %64'tendin)"
6. **Tutarlılık:** "5 gün üst üste açtın 🔥"
7. **Paylaşım kartı:** Tek görsel özet, "Lexify'da haftanı paylaş" CTA

### Teknik tasarım
- Story-style: ekran tap → ileri, sol/sağ swipe → geri
- Her kart 5-6 saniyelik animasyon (Lottie veya basit React Native Reanimated)
- 7. kart `react-native-view-shot` ile PNG export → Instagram Stories / WhatsApp / Twitter

### AI kullanımı
İstatistikler client'tan/Supabase'den. AI sadece "kişiselleştirilmiş tek satır cümle" için:
```
Generate a warm, encouraging 1-sentence summary (in Turkish) for this user's week:
- Words saved: {count}
- Top topic: {topic}
- Streak: {days}
- Mood: celebratory / motivating
```

### Edge case'ler
- Yeni kullanıcı (<3 gün) → Wrapped yerine "Daha çok kullan, gelecek Pazar ilk Wrapped'in" 
- Hiç aktivite yok → gönderme
- Kart hesaplama maliyetli → her Pazar 18:00'da background job, Wrapped JSON'u önceden hazırla, 20:00'da sadece göster

### Başarı metrikleri
- Wrapped görüntülenme oranı (push → açıldı)
- Wrapped tamamlanma (son karta kadar)
- Paylaşım sayısı (özellikle Instagram Stories → en organik kanal)
- Wrapped sonrası 7 gün retention

### Tahmini efor
**M-L** — 10-12 gün. Animasyonlar zaman alır.

### Pro/Free
İkisinde de. Pro farkı: ekstra 2 kart (kelime hafıza grafiği, AI öneri "gelecek hafta odak"). Pro Wrapped'i daha "zengin" hisset.

---

## 3.2 Düello — Async Arkadaş Quiz'i (#5)

### Tek cümle değer önerisi
Arkadaşının kelimeleriyle senin quiz'in. 24 saatlik bir oyun.

### Kullanıcı problemi
Lexify tek başına yapılan bir şey. Kullanıcının çevresi dahil değil → sosyal sermaye yok → viral yok.

### Çözüm
Kullanıcı bir arkadaşına link gönderir. Arkadaş Lexify'a girer (varsa açar, yoksa indirir). 5 soruluk quiz: gönderenin kelimelerinden seçilmiş eşleştirme. Sonuç paylaşılır.

### Kullanıcı akışı (Gönderici)
1. Kelimelerim → "Arkadaşına meydan oku"
2. 5 kelime seç (veya "rastgele 5")
3. Mesaj ekle: "Bunları benden iyi mi bileceksin? 😏"
4. Link üret → WhatsApp/Telegram paylaş

### Alıcı
1. Linke tıkla → Lexify açılır (yoksa universal link App Store'a)
2. "{Ahmet} sana meydan okudu" ekranı
3. 5 soru: EN kelime → 4 TR seçenek (1 doğru)
4. Sonuç: "5/5 — Ahmet'i 1 saniye farkla geçtin 🏆"
5. CTA: "Sen de meydan oku" → kendi kelimelerinden quiz üret
6. Sonuç gönderene push gider: "Ayşe meydanını kabul etti — 4/5 yaptı"

### Teknik tasarım
- **Quiz container:** Supabase `duels` tablosu
```sql
duels (
  id UUID PK,
  sender_user_id,
  receiver_identifier (email/phone optional),
  share_token (unique URL slug),
  words JSONB (5 kelime + distractor seçenekleri),
  sender_score INT,
  sender_time_ms INT,
  receiver_score INT,
  receiver_time_ms INT,
  created_at, completed_at
)
```
- **Distractor (yanlış cevap) üretimi:** Aynı CEFR seviyesinden 3 kelime + onların TR'leri karıştır. Veya LLM ile semantik olarak yakın yanlış cevaplar.
- **Universal link:** `lexify://duel/{token}` ve `https://lexify.app/d/{token}` (yoksa App Store)
- **Anonim alıcı:** Misafir olarak quiz yapabilir, sonunda "Devam et → Lexify aç" CTA

### Edge case'ler
- Gönderici quiz yarıda bıraktı → 7 gün TTL
- Aynı kişiye 24 saatte 1 meydan okuma sınırı
- Kötüye kullanım: spam → IP rate limit

### Viral mekanik
- Sonuç ekranında: "Skoru paylaş" → görsel kart (kim kazandı, kaç kelime)
- Heatmap: "Bu hafta {Ayşe} 12 meydan okuma kazandı"

### Başarı metrikleri
- Düello yaratma oranı (Pro/Free kullanıcı başına)
- Link tıklama → quiz tamamlama
- Yeni kullanıcı edinme: Düello üzerinden ilk kez Lexify'a gelen
- K-faktör: 1 kullanıcı kaç yeni kullanıcı getirdi

### Tahmini efor
**L (Large)** — 12-15 gün. Universal link + anonim akış + state management.

### Pro/Free
- Free: günde 1 düello yaratma
- Pro: sınırsız + "5 yerine 10 soru" + temaya göre filtre

---

## 3.3 CEFR Pasaportu (#10)

### Tek cümle değer önerisi
Görsel bir dil yolculuğu — A1'den C2'ye senin pasaportun.

### Kullanıcı problemi
İlerleme soyut. "10 gün önce nerede idim, şimdi neredeyim?" görmek zor.

### Çözüm
"Profil" sekmesinde görsel bir harita: 6 durak (A1 → A2 → B1 → B2 → C1 → C2). Her durakta:
- Kilometretaş: o seviyeye ait 500 anahtar kelime listesi
- Rozet: "B1 Açıldı" (kullanıcı %25'ini bilince)
- Onay: "B1 Tamamlandı" (%85'ini bilince → bir sonrakine geçer)

Mevcut konum görsel olarak işaretlenir (pin), ilerleyen yol vurgulanır.

### Kullanıcı akışı
1. Profil → "Pasaportum"
2. Yatay scroll edilebilir harita (6 ada/durak metaforu)
3. Her durağa tıkla → detay:
   - Bu seviyede bildiğin kelimeler (örn. 127/500)
   - "Eksiklerini gör" listesi
   - "Bu seviyeye odaklan" — sonraki SM-2 oturumlarında bu kelimelere öncelik
4. Yeni rozet kazanıldığında: tam ekran kutlama + paylaşım kartı

### Veri
- CEFR core word lists (Oxford 3000/5000, English Profile Vocabulary) → her seviye için 500 anahtar kelime, statik JSON
- Kullanıcının `saved_words` ile intersect → ilerleme

### Başarı metrikleri
- Pasaport görüntüleme sıklığı
- Rozet paylaşımı (sosyal kanaldan gelen yeni kullanıcı)
- "Bu seviyeye odaklan" → SM-2 etkileşim artışı

### Tahmini efor
**M (Medium)** — 8-10 gün. Asıl iş tasarım — harita görsel kalitesi.

### Pro/Free
İkisinde de. Pro farkı: "Premium rozetler" (Pro'ya özel altın çerçeve), arkadaşlarla rozet karşılaştırma (Düello listenden).

---

# FAZ 4 — İçerik Genişleme

Yeni kelime kaynakları. Faz 0-3 tamamlandığında pazar olgunlaşmış olur, yeni içerik kanalı eklemek uygun zaman.

## 4.1 Podcast / Şarkı Modu (#8)

### Tek cümle değer önerisi
Spotify'da dinlediğin şarkıdan / podcast'ten kelime topla.

### Kullanıcı problemi
YouTube transcript var ama müzik dinleyiciler ve podcast severler içerik kaynağı dışında.

### Çözüm
Kullanıcı bir Spotify track/episode linki yapıştırır → uygulama:
- **Şarkı:** Lyrics API (Musixmatch / Genius) ile sözleri çek
- **Podcast:** RSS feed veya transcript API (varsa) → transcript

Sonra YouTube modülüyle aynı: oku, kelimelere dokun, kaydet.

### Kullanıcı akışı
1. Keşfet → "Yeni İçerik" → "Spotify Linki"
2. Yapıştır
3. Tür tespiti (track vs episode)
4. İçerik gelir → reader açılır
5. Müzik ise: ses oynatıcı + lyric sync (opsiyonel, post-MVP)

### Teknik gereksinimler
- **Lyrics:** Musixmatch API (ücretli) veya Genius (rate limited free)
- **Podcast transcript:** En basit form, RSS'ten audio URL → Whisper transcribe (Faz 2.2 wrapper'ı kullan)
- Maliyet: 30 dk podcast Whisper transcribe = ~$0.18. Pro feature.

### Edge case'ler
- Lyrics yok → "Bu şarkı için lyrics bulunamadı, başka deneyin"
- Podcast 60 dk+ → ilk 30 dk transcribe + "devamı için Pro"
- Telif: lyrics'i kaydetme, sadece okuma + kelime kaydı

### Başarı metrikleri
- Yeni içerik kaynağı kullanımı
- Pro upgrade (Whisper podcast → Pro tetiği)

### Tahmini efor
**M-L** — 10-12 gün. Lyrics API entegrasyonu + Whisper pipeline (Faz 2.2'den hazır olmalı).

### Pro/Free
- Free: ayda 3 şarkı (lyrics ucuz)
- Pro: sınırsız şarkı + podcast transcribe

---

# Genel Mimari Notları

## Maliyet projeksiyonu (1000 aktif kullanıcı / ay)

**Varsayım:** %10 Pro (100) + %90 Free (900). Model: `gpt-4o-mini` ($0.15/1M in, $0.60/1M out). Whisper: $0.006/dk. Agresif cache aktif.

| Feature | Aylık çağrı | Tahmini maliyet |
|---------|-------------|-----------------|
| Tema sınıflama (Faz 0.3) | 30k | ~$1.5 |
| Mikro-Hikaye (haftalık) | 4k | ~$1.5 |
| Ters Quiz | ~30k | ~$7 |
| Reading Coach | ~10k | ~$12 |
| Ses Günlüğü Whisper | ~2500 dk | ~$15 |
| Ses Günlüğü LLM analiz | ~5k | ~$1 |
| Wrapped | 4k (haftalık) | <$1 |
| Düello / diğer | — | ~$3 |
| **Toplam (mini model + cache)** | | **~$40-50/ay** |

Eğer Reading Coach + Mikro-Hikaye gibi kritik feature'larda `gpt-4o` (tam model, 17x daha pahalı) kullanırsan toplam **$200-250/ay**'a çıkar. Karar: ilk versiyonda hep mini, kullanıcı geri bildirimi kaliteyi sorunlu gösterirse seçici olarak büyük modele geç.

Pro fiyatı $4.99/ay → 50 Pro kullanıcı maliyeti karşılar, gerisi kar.

## Teknik borç önleme

1. Faz 0 atlanırsa Faz 2-3'te yeniden yazılır → atlama
2. Her feature için A/B test framework'ü Faz 1'in sonunda kur (Statsig, PostHog veya basit Supabase flag)
3. LLM prompt'larını versiyonla (`/prompts/v1/...`, `/prompts/v2/...`) — değişiklikler ölçülebilir
4. Maliyet monitoring dashboard'u Faz 0'da Supabase'de bir basit view ile başlat

## Tasarım dili

- Mevcut MVP'nin görsel diline sadık kal
- Yeni feature'lar "Lexify hissi" vermeli — abartılı animasyon yok, akıcılık öne çıksın
- Renk kodu: pasif maruziyet (Faz 1) sarı tonları, üretim (Faz 2) mavi, sosyal (Faz 3) mor

## Lansman stratejisi

- Faz 1 bittiğinde minor version bump (1.1) — App Store "Yenilik": "Kelimelerin makalede karşına çıkar artık"
- Faz 2 bitince 2.0 — büyük lansman + ProductHunt
- Her faz sonu QA checklist (mevcut MVP'deki gibi)
- Türkçe topluluğa (örn. Reddit r/TurkeyTechnology, Twitter dil öğrenme hesapları) outreach

---

# Geliştirme Disiplinleri

Bu yol haritasını uygulayabilmek için kendine söz vermen gereken şeyler:

1. **Faz atlamama:** Önce 0, sonra 1, sonra 2. Cazip de olsa 3'e atlama.
2. **Her feature için "tamamlanma" tanımı:** Sadece çalışıyor değil — log'lanıyor, metrik var, edge case'ler test edilmiş.
3. **Haftalık review:** Cuma akşamları o haftanın metrikleri + sonraki haftanın 3 görevi.
4. **AI prompt'ları kod gibi:** Prompt değişikliği = commit + changelog. "Promptu biraz değiştirdim" geri dönüş cehennemi yaratır.
5. **Bir feature'ı gönder, **2 hafta** bekle, **sonra** bir sonrakine geç.** Erken optimizasyon ve erken yeni feature aynı tuzak.

---

# Doğrulama Kontrol Listesi

Bu doküman doğru bir plan mı? Şunlar kontrol edildi:

- [x] Her faz bir öncekine bağımlı (Faz 1 ← Faz 0 altyapı)
- [x] Her feature net problem → çözüm → metrik
- [x] Pro/Free segmentasyonu her feature'da var
- [x] Maliyet tahmini sürdürülebilir aralıkta
- [x] Edge case'ler kritik akışlarda düşünüldü
- [x] AI kullanımı tek wrapper üzerinden (Faz 0.2)
- [x] Tahmini toplam efor (~5-6 ay) gerçekçi

---

*Son güncelleme: 2026-05-19. Bu doküman yaşayan bir belgedir; her faz sonu güncellenmesi tavsiye edilir.*
