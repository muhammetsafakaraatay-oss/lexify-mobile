# Ses Günlüğü (Voice Echo) — Teknik Spec

> Faz 2.2 — Pro conversion'ın ana silahı. Whisper transcribe + LLM analiz + kayıt arşivi.
> Tahmini efor: 14-18 gün. Bağımlılık: Faz 0.2 (LLM wrapper) hazır olmalı.

## 1. Hedef ve Ölçüm

### Tek cümle değer önerisi
Kelimelerini kendi sesinle kullan; telaffuzun, gramerin ve akıcılığın için AI koçun.

### Başarı metrikleri (her biri ölç ve dashboard'a koy)

| Metrik | Hedef | Tablo / Event |
|--------|-------|---------------|
| Sesli pratik başlatma → tamamlama | >70% | `voice_sessions.status` |
| Free → Pro conversion (paywall buradan tetiklendi) | >5% / ay | `pro_upgrades.trigger_feature='voice_echo'` |
| Haftalık aktif konuşan kullanıcı (HAKK) | 1000 MAU'da >200 | distinct user_id, son 7 gün |
| Ortalama oturum skoru zaman içinde | aylık +3 puan | trend analizi |
| Whisper API hata oranı | <2% | `ai_calls.success=false WHERE feature='voice_transcribe'` |

---

## 2. Kullanıcı Akışı

### 2.1 Giriş noktaları
1. **Çalış sekmesi → "Sesli Pratik" kartı** (ana giriş)
2. **Profil → V2 Özellikler → Sesli Pratik**
3. **Wrapped sonu CTA:** "Bu hafta sesli de pratik yap"
4. **Ters Quiz sonrası önerisi:** "Yazdın, şimdi sesle dene"

### 2.2 Ana akış (happy path)

```
[Sesli Pratik kart]
    ↓ tap
[Hazırlık ekranı]
  - Prompt: "Şu 4 kelimeyi kullanarak 30 saniyelik bir gün anlatımı yap:
              opportunity, deliberate, fortunate, commute"
  - "Başla" butonu
  - Mikrofon izni kontrol
    ↓ Başla
[Geri sayım: 3-2-1]
    ↓
[Kayıt ekranı — 30 sn]
  - Büyük kayıt dalgası animasyonu (waveform)
  - Geri sayım: 30 → 0
  - "Bitir" butonu (erken bitirme)
  - "İptal" butonu
    ↓ 30 sn doldu / Bitir
[İşleme ekranı]
  - Loading: "Sesin analiz ediliyor..."
  - 3 aşama indicator:
    1. Transkripsiyon (Whisper)
    2. Telaffuz analizi
    3. Gramer & kelime kontrolü
    ↓ ~5-8 saniye
[Sonuç ekranı]
  - Genel skor: 78/100
  - Transcript (kelime kelime, düşük confidence renkli)
  - Hedef kelimeler checklist (kullanıldı / kullanılmadı)
  - Top 3 gramer feedback
  - Akıcılık: 95 kelime/dakika
  - Butonlar: "Yeniden Dene" | "Kaydı Sakla" (Pro) | "Sonraki"
```

### 2.3 Edge case akışları

**Mikrofon izni reddedildi:**
```
[Açıklama modal] → "Lexify mikrofonuna ihtiyaç duyar"
  → "Ayarları aç" → iOS Settings deep link
  → "Vazgeç" → Çalış sekmesine geri
```

**Sessizlik / çok düşük ses (kayıt sırasında):**
- 10 sn'de hiç ses tespit edilmedi → "Mikrofona daha yakın konuş, devam ediyorum"
- 30 sn boyunca hiç ses → "Bir ses algılayamadım. Tekrar dene."

**Türkçe konuşma tespit edildi:**
- Whisper `language` field'ı `tr` döndürürse:
  - "Lütfen İngilizce konuş 🇬🇧 — Tekrar dene"
  - Sayıma sayma, oturum boşa gitmesin

**Kayıt 5 saniyeden kısa:**
- "Daha uzun konuşursan daha iyi feedback alırsın. Tekrar dene?"

**Whisper API hatası:**
- 2 retry
- Hâlâ hata → "Şu an analiz yapamıyorum. Sesi şuraya kaydettim, sonra tekrar deneyebilirsin." (Pro için kayıt korunur, free'de uyarı)

**Free kullanıcı haftalık limit dolu:**
- Hazırlık ekranında: "Bu hafta hakkın doldu. Salı yenilenecek. Pro'ya geç →"
- Paywall: özellik vurgulu (Sesli pratik sınırsız)

---

## 3. UI / Ekran Komponentleri

### 3.1 Yeni ekranlar

```
app/(tabs)/sesli/
  ├── index.tsx              // Hazırlık + Sesli Pratik kart girişi
  ├── prompt.tsx             // Kelime seçimi + prompt gösterimi
  ├── recording.tsx          // Aktif kayıt ekranı
  ├── processing.tsx         // Loading + aşama gösterimi
  ├── result.tsx             // Sonuç + feedback
  └── archive.tsx            // (Pro) Geçmiş kayıtlar
```

### 3.2 Yeni komponentler

```
components/voice/
  ├── WaveformAnimation.tsx  // Kayıt sırasında dalga (level-driven)
  ├── CountdownTimer.tsx     // 30→0 büyük rakam
  ├── TranscriptDisplay.tsx  // Kelime kelime render, confidence renkli
  ├── WordChecklist.tsx      // Hedef kelime kullanıldı mı checkmark
  ├── ScoreCircle.tsx        // 78/100 büyük yuvarlak gösterge
  ├── FeedbackCard.tsx       // Gramer/anlam feedback kartları
  └── FluencyMeter.tsx       // Kelime/dakika çubuğu
```

### 3.3 Renk kodu (Faz 2 = mavi tonları)

- Primary action: `#2563EB` (mavi-700)
- Yüksek confidence kelime: default text
- Orta confidence (0.5-0.8): `#F59E0B` (amber)
- Düşük confidence (<0.5): `#DC2626` (kırmızı)
- Skor renkleri: 0-50 kırmızı, 51-75 amber, 76-100 yeşil

---

## 4. Backend / Veri Modeli

### 4.1 Yeni tablolar (Supabase)

```sql
-- Ana oturum tablosu
CREATE TABLE voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('recording', 'processing', 'completed', 'failed', 'cancelled')),

  -- Prompt
  target_words TEXT[] NOT NULL,           -- ['opportunity', 'deliberate', ...]
  prompt_text TEXT NOT NULL,              -- Kullanıcıya gösterilen prompt
  prompt_lang TEXT DEFAULT 'tr',

  -- Kayıt
  audio_url TEXT,                          -- Supabase Storage URL (Pro için kalıcı)
  audio_duration_ms INT,
  audio_size_bytes INT,

  -- Transkripsiyon
  transcript TEXT,
  transcript_word_timings JSONB,           -- [{word, start, end, confidence}]
  detected_language TEXT,                  -- 'en' bekleniyor

  -- Analiz
  scores JSONB,                             -- {pronunciation, grammar, word_usage, fluency, total}
  feedback JSONB,                           -- {grammar_issues: [...], word_checklist: [...]}
  words_per_minute INT,

  -- Meta
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Telaffuz odaklı kelime tracker (zayıf telaffuzlar burada birikir)
CREATE TABLE voice_pronunciation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  word TEXT NOT NULL,
  voice_session_id UUID REFERENCES voice_sessions(id),
  confidence FLOAT,                        -- Whisper logprob türevi 0-1
  attempts INT DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  best_confidence FLOAT
);

CREATE INDEX idx_voice_sessions_user_created ON voice_sessions(user_id, created_at DESC);
CREATE INDEX idx_pron_history_user_word ON voice_pronunciation_history(user_id, word);

-- Haftalık limit takibi (free için)
-- (Mevcut user_quotas tablosu varsa oraya kolon ekle, yoksa yeni view)
CREATE OR REPLACE VIEW user_voice_quota AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW())) AS sessions_this_week,
  CASE
    WHEN COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW())) >= 1 THEN false
    ELSE true
  END AS can_record_free
FROM voice_sessions
GROUP BY user_id;
```

### 4.2 Supabase Storage bucket

```
bucket: voice-recordings (private, RLS enabled)
yapı: {user_id}/{voice_session_id}.m4a

Lifecycle:
- Free kullanıcı: kayıt analizden sonra 1 saat içinde silinir
- Pro kullanıcı: kalıcı (30 gün sonra eski oturumları soft delete'e taşı)

Boyut tahmini:
- 30 sn @ 16kHz mono m4a ≈ 90KB
- 1000 Pro kullanıcı × günde 1 × 30 gün = 30000 kayıt = ~2.7GB/ay
- Supabase Storage ücreti: ilk 1GB free, sonrası ~$0.021/GB → ~$0.06/ay (ihmal)
```

### 4.3 Row Level Security (RLS)

```sql
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own sessions"
  ON voice_sessions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions"
  ON voice_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions"
  ON voice_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Aynı pattern voice_pronunciation_history için
```

---

## 5. Audio Capture

### 5.1 Kütüphane

`expo-av` (zaten projede muhtemelen var, react-native-audio-recorder-player alternatifi)

### 5.2 Kayıt ayarları

```typescript
const RECORDING_OPTIONS = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};
```

Neden 16kHz: Whisper sample rate beklentisi. Yüksek değer = boş yere büyük dosya.
Neden mono: Whisper stereo kullanmaz.

### 5.3 Permission flow

```typescript
async function ensureMicrophonePermission(): Promise<boolean> {
  const { status } = await Audio.requestPermissionsAsync();
  if (status === 'granted') return true;

  // İlk red değilse (sistem ayarlarına yönlendir)
  Alert.alert(
    'Mikrofon İzni Gerekli',
    'Sesli pratik için mikrofona ihtiyacımız var. Ayarlardan izin verebilirsin.',
    [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Ayarları Aç', onPress: () => Linking.openSettings() },
    ]
  );
  return false;
}
```

### 5.4 Waveform level reading

```typescript
recording.setOnRecordingStatusUpdate((status) => {
  if (status.isRecording) {
    // status.metering: -160 (sessizlik) ile 0 (en yüksek) arası dB
    const normalized = Math.max(0, Math.min(1, (status.metering + 60) / 60));
    setWaveformLevel(normalized);
  }
});
```

WaveformAnimation komponenti son N örneği saklayıp animated bar göstersin (60 fps gereksiz, 10 fps yeterli).

---

## 6. AI Pipeline

### 6.1 Whisper transkripsiyon

**Sağlayıcı:** OpenAI Whisper API (`whisper-1` veya `gpt-4o-transcribe`)
**Alternatif:** Self-hosted `whisper.cpp` (gelecek optimizasyon, ilk versiyonda OpenAI)

```typescript
// server/ai/voice.ts (proxy üzerinden çağrılır, anahtar client'ta yok)

async function transcribeAudio(audioFile: File, userId: string) {
  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');          // Beklenen dil
  formData.append('response_format', 'verbose_json');  // Word-level timestamps için
  formData.append('timestamp_granularities[]', 'word');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}` },
    body: formData,
  });

  const data = await response.json();
  // data.text, data.language, data.words: [{word, start, end}]

  // Log AI call (Faz 0.2 wrapper standardı)
  await logAICall({
    feature: 'voice_transcribe',
    userId,
    durationMs: audioDurationMs,
    cost: estimateWhisperCost(audioDurationMs),
    success: true,
  });

  return data;
}
```

**Maliyet:** 30 sn @ Whisper-1 = $0.006/dakika × 0.5 dakika = **$0.003 per session**.

### 6.2 LLM analiz (transcript sonrası)

```typescript
const SYSTEM_PROMPT = `You are an English speaking coach evaluating a learner's spoken response.

Output STRICT JSON. No prose outside JSON.`;

const USER_PROMPT = `
The learner was asked to use these target words in their speech: {target_words}

Transcript: "{transcript}"
Duration: {duration_sec} seconds
Words spoken: {word_count}
Detected language: {detected_lang}

Evaluate on these dimensions (each 0-100):
1. word_usage: Did they use each target word? Was usage correct/natural?
2. grammar: Verb tense, articles, prepositions, word order
3. fluency: Coherence, sentence completion, natural flow (consider WPM and pause patterns)
4. relevance: Did they address the prompt?

Then compute total = round(0.35*word_usage + 0.30*grammar + 0.25*fluency + 0.10*relevance)

Return JSON:
{
  "scores": {
    "word_usage": 0,
    "grammar": 0,
    "fluency": 0,
    "relevance": 0,
    "total": 0
  },
  "word_checklist": [
    {"word": "opportunity", "used": true, "natural": true, "context": "great opportunity to learn"},
    {"word": "deliberate", "used": false, "natural": null, "context": null}
  ],
  "grammar_issues": [
    {"original": "I have went", "correction": "I have gone", "rule": "past participle of 'go'"}
  ],
  "feedback_tr": "Konuşman akıcı, ama 'deliberate' kelimesini kullanmamışsın. Gramer olarak 'have went' yerine 'have gone' demelisin.",
  "encouragement_tr": "İlk denemen için iyi! Bir dahaki sefere hedef kelimeleri kontrol et."
}
`;
```

**Model:** `gpt-4o-mini` ilk versiyonda (ucuz, Türkçe iyi).
**Maliyet:** ~600 input + 400 output token = $0.00033 per session. İhmal edilebilir.

### 6.3 Telaffuz skoru (transcript'ten türev)

Whisper API word-level confidence vermez (sadece timestamp). İki yaklaşım:

**Basit:** Whisper'ın detected_language doğru ise + tüm kelimeler düzgün transkribe olduysa, telaffuz iyi sayılır. Hedef kelime listesinden hangileri **doğru transkribe oldu** kontrol et:

```typescript
function pronunciationCheck(
  targetWords: string[],
  transcriptWords: {word: string, start: number, end: number}[]
) {
  const stems = transcriptWords.map(w => stem(w.word.toLowerCase()));
  return targetWords.map(tw => {
    const targetStem = stem(tw.toLowerCase());
    const found = stems.includes(targetStem);
    return {
      word: tw,
      transcribed_correctly: found,
      confidence: found ? 0.9 : 0.3,   // proxy
    };
  });
}
```

**Gelişmiş (sonraki versiyon):** `gpt-4o-transcribe` veya AssemblyAI ile word-level confidence al, gerçek pronunciation score üret.

---

## 7. Prompt Üretimi (Kelime seçimi)

### 7.1 Kullanıcının kelimelerinden 3-5 hedef seç

Algoritma:
```
1. Kullanıcının saved_words'ünü çek
2. SM-2 öncelik sırasına göre sırala (en yakın tekrar tarihi olanlar)
3. CEFR seviyesi kullanıcının current_level ± 1 olanları filtrele
4. Son 7 günde Ses Günlüğü'nde kullanılmış olanları çıkar
5. İlk 4-5'ini al
6. Kelimeler hiç yoksa, fallback: CEFR seviyesine uygun popular word listesinden
```

### 7.2 Prompt template'leri (rotasyon)

Türkçe sorulan ama İngilizce konuşulması gereken prompt'lar:

```typescript
const PROMPT_TEMPLATES = [
  "Şu {n} kelimeyi kullanarak bugünün en güzel anını anlat:",
  "Bu kelimelerle bir kahve molasında arkadaşına ne anlatırdın?",
  "Bir gezi planı yap ve şu kelimeleri kullanmaya çalış:",
  "Şu kelimelerle son izlediğin bir filmi anlat:",
  "Bu kelimelerle kendine sabah motivasyonu ver:",
  "Bir restoran deneyimini anlatıyormuşsun gibi şu kelimeleri kullan:",
];
```

Her kullanıcı için template tekrarlamamak için son 5 oturumda kullanılanları suppress.

---

## 8. Pro / Free Segmentasyonu

### 8.1 Free
- **Haftada 1 sesli pratik oturumu** (Salı 00:00 lokal yenilenir)
- Kayıt analizden sonra silinir (audio_url null)
- Arşiv ekranı kilitli (paywall)
- Sonuç ekranında telaffuz feedback'i basit ("doğru/yanlış")

### 8.2 Pro
- **Günde 1 sesli pratik** (gerçekten "limitsiz" değil — maliyet için)
- Kayıtlar 30 gün kalıcı, arşivden tekrar dinlenebilir
- Gelişmiş feedback: gramer + telaffuz detay + akıcılık trend grafiği
- "Zayıf telaffuzun" listesi (voice_pronunciation_history'den)
- Özel prompt seçimi (kendi temasını yaz)

### 8.3 Paywall tetikleyici

```
Trigger 1: Free kullanıcı 2. kez denerken
  → "Bu hafta hakkın doldu. Pro ile sınırsız."

Trigger 2: Sonuç ekranı sonu (Free)
  → Kapsayan kart: "Pro ile kayıtların kalıcı + ilerlemeni gör"
  → Convert oranı yüksek olmalı (özellik tam değer noktasında gösteriliyor)

Trigger 3: 3 sesli pratik tamamladı (alışkanlık kanıtı)
  → "Pro ile haftada 7 kat daha fazla pratik yapabilirsin"
```

---

## 9. Implementation Sırası (Sub-task Breakdown)

> Toplam: 14-18 gün. Aşağıdaki sıra critical path.

### Sprint 1 — Temel kayıt (4-5 gün)
- [ ] DB migration (voice_sessions, voice_pronunciation_history tabloları)
- [ ] Supabase Storage bucket + RLS
- [ ] Mikrofon izin akışı
- [ ] `expo-av` ile kayıt başlatma/durdurma
- [ ] Kayıt dosyasını Supabase Storage'a upload
- [ ] Test: 30 sn kayıt → storage'da .m4a görülüyor

### Sprint 2 — Whisper entegrasyonu (3-4 gün)
- [ ] Proxy endpoint: audio file → Whisper API → JSON return
- [ ] Client'tan proxy'ye çağrı + retry
- [ ] Transcript'i voice_sessions'a kaydet
- [ ] AI call log (Faz 0.2 wrapper'a uygun)
- [ ] Hata yönetimi (timeout, rate limit, format hatası)
- [ ] Test: Kayıt → 5-10 sn içinde transcript

### Sprint 3 — UI akışı (3-4 gün)
- [ ] Prompt ekranı + kelime seçimi
- [ ] Waveform animasyonu + countdown
- [ ] Processing ekranı (3 aşama indicator)
- [ ] Mikrofon izin UX (red durumu dahil)
- [ ] Geri sayım sonunda otomatik dur
- [ ] Test: Tam akış end-to-end

### Sprint 4 — LLM analiz + sonuç (3-4 gün)
- [ ] LLM prompt'u (JSON schema validation)
- [ ] Skor hesaplama + word checklist
- [ ] Sonuç ekranı (ScoreCircle, FeedbackCard, WordChecklist)
- [ ] Telaffuz tracker (voice_pronunciation_history kayıt)
- [ ] Türkçe feedback render
- [ ] Test: 10 farklı transcript için tutarlı skor

### Sprint 5 — Pro gating + paywall (2 gün)
- [ ] user_voice_quota view ile limit kontrolü
- [ ] Paywall tetikleyici 3 noktada
- [ ] Free kullanıcı için audio_url silme job'u (1 saat sonra)
- [ ] RevenueCat entegrasyon noktası (zaten kuruluysa)
- [ ] Test: Free 1/hafta, Pro günde 1 limit

### Sprint 6 — Arşiv (Pro) + cila (2-3 gün)
- [ ] Arşiv ekranı (oturum listesi)
- [ ] Tek oturum detay (transcript + tekrar dinleme)
- [ ] Telaffuz trend grafiği (ScoreCircle değişimi son 30 gün)
- [ ] Empty state, loading skeleton'ları
- [ ] Tab bar veya Çalış sekmesine giriş kartı

### Sprint 7 — QA + lansman (1-2 gün)
- [ ] TestFlight build
- [ ] 5-10 kullanıcı beta testi (kendin + arkadaşlar)
- [ ] Edge case test: hızlı konuşma, aksanlı konuşma, sessizlik
- [ ] Metrik dashboard kontrol
- [ ] App Store update notları

---

## 10. Maliyet Projeksiyonu

### Bir oturum maliyeti

| Komponent | Miktar | Birim Fiyat | Toplam |
|-----------|--------|-------------|--------|
| Whisper transkripsiyon | 0.5 dk | $0.006/dk | $0.003 |
| LLM analiz (gpt-4o-mini) | ~1000 token | varies | $0.0003 |
| Supabase Storage (Pro 30 gün) | 90KB | ~$0.021/GB/ay | <$0.001 |
| **Toplam** | | | **~$0.004/oturum** |

### Aylık tahmini (1000 MAU, %10 Pro)

- Free: 900 user × 4 oturum/ay (haftalık 1) = 3600 oturum
- Pro: 100 user × 15 oturum/ay (her gün değil) = 1500 oturum
- **Toplam: ~5100 oturum × $0.004 = ~$20/ay**

Roadmap'teki başlangıç tahminim ($16) doğru aralıkta.

---

## 11. Risk ve Karşı Önlemler

| Risk | Olasılık | Etki | Önlem |
|------|----------|------|-------|
| Whisper Türkçe konuşmayı İngilizce zannedebilir | Düşük | Orta | `detected_language` field'ını kontrol et, !en ise reddet |
| Kullanıcı aksanı Whisper'ı zorlar | Orta | Orta | Confidence threshold düşük tut, kullanıcıya nazik geribildirim |
| Audio upload yavaş (yavaş ağlarda) | Orta | Yüksek | Background upload + retry. Kullanıcı sonuç ekranına geçmeden tamamlanmalı |
| LLM tutarsız skorlar verir | Yüksek | Yüksek | Aynı transcript için temperature=0 + deterministic seed. Tutarlılık testi |
| Whisper API outage | Düşük | Yüksek | Status'u failed yap, kullanıcıya "Sonra tekrar dene" |
| Mikrofon arka planda açık kalır | Düşük | Düşük | onUnmount'ta forcibly stop. Sayfa değişimde recording.stopAndUnloadAsync() |
| Kullanıcı 1 dk konuşmak ister | Yüksek | Düşük | İlk versiyonda max 30 sn. Pro için sonradan 60 sn opsiyon |

---

## 12. Test Stratejisi

### 12.1 Manuel test senaryoları (Sprint 7)

1. **Happy path:** 30 sn İngilizce konuş, 4 kelime kullan → tam akış
2. **Eksik kelime:** 4 kelime verildi, 2'sini kullan → word_checklist doğru
3. **Türkçe konuş:** detected_language='tr' → red mesajı
4. **Mikrofon izni reddi:** İlk kez red → ayarlar deep link
5. **5 sn kayıt:** Çok kısa → "daha uzun konuş" uyarı
6. **Sessizlik:** 30 sn boyunca konuşma → transcript boş, hata
7. **Free 2. deneme:** Aynı hafta → paywall
8. **Pro arşiv:** 5 oturum yap → arşivde 5 görüldü
9. **Offline:** Kayıt başlat, internet kapat → uyarı, retry kuyruğu
10. **Background:** Kayıt sırasında telefonu kilitle → kayıt durur

### 12.2 Automated test (Jest)

- `scoreCalculation.test.ts`: LLM JSON → ScoreCircle props
- `quotaService.test.ts`: Free haftada 1 limit logic
- `pronunciationCheck.test.ts`: Hedef kelime stem matching

### 12.3 LLM tutarlılık testi

Aynı 5 transcript'i 10 kez analiz et, skor varyansı ±3 puandan az olmalı. Aksi halde prompt'u sertleştir veya temperature=0 kullan.

---

## 13. Lansman Sonrası — İlk 2 Hafta

### Bakılacak metrikler (her gün)
- Oturum başlatma → tamamlama oranı (drop-off nerede?)
- Whisper hata oranı (API sağlığı)
- LLM skor dağılımı (çok yüksek/çok düşük cluster var mı?)
- Paywall görüntülenme → conversion
- Crash logs (Sentry/Bugsnag varsa)

### İyileştirme alanları (öncelik sırasıyla)
1. Whisper başarısı düşükse: bitrate artır veya `gpt-4o-transcribe`'a geç
2. Drop-off yüksekse: hangi ekranda? Prompt mu zor, kayıt mı korkutuyor?
3. Conversion düşükse: paywall mesajını test et (A/B)
4. Pro kullanıcı tekrar etmiyorsa: hatırlatma push (3 gün kullanmadıysa)

---

## 14. Doğrulama Kontrol Listesi

- [x] Veri modeli RLS dahil tam
- [x] AI pipeline her aşamada error handling
- [x] Free/Pro limit logic tablo seviyesinde tanımlı
- [x] Mikrofon izin akışı edge case'ler dahil
- [x] Maliyet sürdürülebilir aralıkta
- [x] 7 sprint'lik plan critical path takip ediyor
- [x] Test senaryoları gerçek dünya durumlarını kapsıyor
- [x] Risk matrisi her yüksek etkili riski adresliyor
- [x] Lansman sonrası ölçüm noktaları net

---

*Son güncelleme: 2026-05-20. Bağımlılık: Faz 0.2 LLM wrapper tamamlanmış olmalı.*
