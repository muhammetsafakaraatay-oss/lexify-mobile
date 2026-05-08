# Replit Prompt — Sprint 1: SRS (Spaced Repetition) Sistemi

> Bunu Replit Agent'a (veya Cursor / Claude Code'a) olduğu gibi yapıştır.
> Tek bir sprint için yazıldı: önce SRS motorunu sağlam kuracağız, push notification ve onboarding sonraki sprintlerde.

---

## ROLE

Sen senior bir React Native + TypeScript geliştiricisin. Expo Router, Supabase ve öğrenme bilimi (spaced repetition / SM-2 / FSRS) konularında uzmansın. Kod yazarken üretim kalitesinde, test edilebilir, type-safe çıktı verirsin. Asla `any` kullanmaz, hata yönetimini sessiz geçmezsin.

## PROJE BAĞLAMI

Lexify (paket adı: `lexitr-mobile`), Türkiye'deki kullanıcıların İngilizce öğrenmesi için yapılmış bir Expo + React Native uygulaması.

**Mevcut stack:**
- Expo SDK 54, Expo Router 6 (file-based routing)
- React 19, React Native 0.81
- Supabase (auth + Postgres) — `lib/supabase.ts`
- TypeScript ~5.9
- Yardımcı backend: `https://lexitr.vercel.app` (çeviri, makale, OCR, YouTube transcript)

**Mevcut ekranlar:** dashboard, oku, catalog, search, words, flashcards, quiz, camera, video, history, collections, profile, onboarding, auth/login.

**Mevcut Supabase tabloları (tahmini):**
- `saved_words(id, user_id, word, translation, context, example, ipa, cefr, source_title, source_url, source_type, mastered, review_count, created_at)`
- `reading_history(id, user_id, title, url, word_count, created_at)`
- `collections(id, user_id, name, emoji)`
- `collection_words(collection_id, word_id)`

**Mevcut flashcard problemi:**
`app/(tabs)/flashcards.tsx` çok ilkel. "Biliyorum" deyince `review_count++`, üç olunca `mastered=true`. Aralıklı tekrar yok, due-date yok, lapses (unutma) yönetimi yok, zorluk derecesi yok. Bu sprintte bunu düzelteceğiz.

## SPRİNT HEDEFİ

**SM-2 tabanlı (Anki'nin algoritması) bir spaced repetition sistemi kur.** Kullanıcı her review'da 4 dereceli cevap versin (Tekrar / Zor / İyi / Kolay). Sistem her kelime için bir sonraki review tarihini hesaplasın. Dashboard'da "bugün gözden geçirilecek X kelime" göstersin. Flashcard ekranı yalnızca due olanları getirsin.

## YAPILACAKLAR

### 1) Veritabanı Migration

Supabase SQL editor'da çalıştırılacak migration dosyası üret (`supabase/migrations/0001_srs.sql`):

```sql
alter table saved_words
  add column if not exists ease numeric not null default 2.5,
  add column if not exists interval_days integer not null default 0,
  add column if not exists repetitions integer not null default 0,
  add column if not exists lapses integer not null default 0,
  add column if not exists due_at timestamptz not null default now(),
  add column if not exists last_reviewed_at timestamptz,
  add column if not exists stage text not null default 'new'
    check (stage in ('new','learning','review','mastered','leech'));

create index if not exists saved_words_user_due_idx
  on saved_words(user_id, due_at);

create index if not exists saved_words_user_stage_idx
  on saved_words(user_id, stage);
```

`mastered` boolean alanını `stage='mastered'` ile değiştir; geriye dönük uyumluluk için `mastered` alanını okumayı kaldır ama yazmayı bir süre koru (deprecation note bırak).

### 2) SRS Motoru (`lib/srs.ts`)

Saf, side-effect-free fonksiyonlar — kolay test edilsin:

```ts
export type Grade = 'again' | 'hard' | 'good' | 'easy'

export interface SrsState {
  ease: number          // SM-2 EF, min 1.3
  interval: number      // days
  repetitions: number   // ardışık doğru
  lapses: number        // toplam başarısız
  dueAt: Date
  lastReviewedAt: Date | null
  stage: 'new' | 'learning' | 'review' | 'mastered' | 'leech'
}

export function applyGrade(state: SrsState, grade: Grade, now = new Date()): SrsState
export function isDue(state: SrsState, now = new Date()): boolean
export function nextDueLabel(state: SrsState, now = new Date()): string  // "5 dk", "1 gün", "2 hafta"
```

**SM-2 kuralları:**
- `again`: repetitions=0, interval=0 (10 dk sonra yeniden), lapses++, ease -= 0.20 (min 1.3). Eğer lapses >= 8 → stage='leech'.
- `hard`: interval = max(1, prev_interval * 1.2), ease -= 0.15, repetitions++.
- `good`:
  - repetitions=0 ve interval=0 → interval=1 gün
  - repetitions=1 → interval=6 gün
  - aksi → interval = round(prev_interval * ease)
  - repetitions++
- `easy`: good gibi ama interval *= 1.3, ease += 0.15.
- Ease: 1.3 ile 3.0 arasında clamp.
- Stage geçişleri: new → learning (ilk doğru) → review (interval >= 1 gün) → mastered (interval >= 30 gün ve lapses < 3).

### 3) Veri Katmanı Güncellemesi (`lib/data.ts`)

Mevcut `updateSavedWordReview(word, 'know'|'dontknow')` fonksiyonunu **kaldırma** ama **deprecate et** (yorum ekle). Yerine:

```ts
export interface SavedWord {
  // ... mevcut alanlar
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at: string         // ISO
  last_reviewed_at: string | null
  stage: 'new' | 'learning' | 'review' | 'mastered' | 'leech'
}

export async function listDueWords(limit = 20): Promise<SavedWord[]>
export async function listNewWords(limit = 5): Promise<SavedWord[]>
export async function gradeWord(word: SavedWord, grade: Grade): Promise<SavedWord>
export async function getDueCount(): Promise<{ due: number; new: number; learning: number }>
```

`gradeWord` içinde:
1. SavedWord → SrsState dönüştür
2. `applyGrade` çağır
3. Yeni state'i Supabase'e yaz (`update ... eq id ... eq user_id`)
4. Güncellenmiş word'ü döndür

### 4) Yeni Flashcard Ekranı (`app/(tabs)/flashcards.tsx`)

Mevcut dosyayı **yeniden yaz**. Kuralları:

- Açılışta `getDueCount` ile başlık: "Bugün: 12 review · 5 yeni · 3 öğrenilmekte"
- `listDueWords(20)` çağır; boşsa `listNewWords(5)` ile yeni kelimelerden tamamla (max 20).
- Eski 2-buton (✓ Biliyorum / ✗ Bilmiyorum) yerine **4 buton**:
  - Tekrar (kırmızı, sol) — "again"
  - Zor (turuncu) — "hard"
  - İyi (yeşil) — "good"
  - Kolay (mavi, sağ) — "easy"
- Her butonun altında bir sonraki review aralığı görünsün: "10dk · 1d · 4d · 12d" gibi (`nextDueLabel` ile preview).
- Card flip animasyonu mevcut hâliyle kalsın, ama `useNativeDriver: true` korunsun.
- Bitince özet ekranı: doğruluk yüzdesi, en zorlandığı 3 kelime, "yarın yeniden" mesajı.
- Stage='leech' olan kelimeler için ekran üstünde küçük bir uyarı: "Bu kelime sana zor geliyor — context'i yeniden oku."

### 5) Dashboard Entegrasyonu (`app/(tabs)/dashboard.tsx`)

Mevcut "Toplam / Bugün / Bu Hafta / Öğrenildi" kartlarına bir kart daha ekle: **"Bugün Gözden Geçir"** — `getDueCount().due` değeri büyük rakamla. Tıklayınca flashcards'a yönlendirsin.

İlk pozisyona al; bu kullanıcının her gün ilk göreceği şey olmalı.

`mastered` sayımını `stage='mastered'` üzerinden hesapla.

### 6) Testler (`__tests__/srs.test.ts`)

`lib/srs.ts` için Jest + React Native Testing Library kur (yoksa). Şu senaryoları test et:

- Yeni kelime, 4 kez ardışık `good` → interval ilerlemesi (0 → 1 → 6 → ~15 → ~37 gün)
- 3 doğrudan sonra `again` → repetitions sıfırlanır, lapses 1, interval 0
- Ease asla 1.3'ün altına düşmez
- 8 lapses sonrası stage='leech'
- `easy` ile `good` arasındaki interval farkı > %25
- `nextDueLabel` çıktıları: 0.5 saat → "30 dk", 1 gün → "1 gün", 14 gün → "2 hafta"

Komut: `npm test` çalışır olmalı. `package.json`'a `test: "jest"` script'i ekle.

### 7) Migration Geri Uyumluluğu

Mevcut kullanıcıların `saved_words` kayıtlarına default değerler atanacak (migration default'ları halleder). İlk açılışta hiç review yapmamış kullanıcı için tüm kelimeler `stage='new'`, `due_at=now()` olacağından flashcard'ta görünür. Bu kasıtlı.

## YAPILMAYACAKLAR (ŞU AN İÇİN)

- Push notification (sonraki sprint).
- Onboarding revizyonu (sonraki sprint).
- Yeni sınav modları (çoktan seçmeli, dinleme vs.) — sonraki sprint.
- AI sohbet, yazma koçu — sonraki sprint.
- UI bütün uygulamayı redesign — sadece flashcards + dashboard kartı.
- `quiz.tsx`, `camera.tsx`, `video.tsx` ekranlarına dokunma.

## TEKNİK KISITLAR

- TypeScript `strict` modunda yaz; `any` yasak. (Mevcut `tsconfig.json` strict değilse, sadece yeni dosyalar için bile olsa lokal `as` cast'i tercih et.)
- Supabase çağrılarında her zaman `eq('user_id', userId)` filtresi ekle (RLS olmasa bile).
- Hata yönetimi: try/catch boş bırakma; en azından `console.warn` + kullanıcıya görünür hata state.
- React state'lerinde `any` kullanma (mevcut dosyada `useState<any>` var, ama yeni yazdığın dosyalarda yapma).
- `'use client'` direktifini ekleme; bu Expo değil, Next.js direktifi.
- Tüm string'ler Türkçe; ama kelimelerin kendi içeriği değişmez (örn: "again", "hard" kod tarafında; UI'da "Tekrar", "Zor").

## DOSYA LİSTESİ (ÇIKTI)

Yeni:
- `supabase/migrations/0001_srs.sql`
- `lib/srs.ts`
- `__tests__/srs.test.ts`
- `jest.config.js` (yoksa)

Değiştirilecek:
- `lib/data.ts` (yeni fonksiyonlar + tip güncellemesi)
- `app/(tabs)/flashcards.tsx` (yeniden yazım)
- `app/(tabs)/dashboard.tsx` (kart ekleme + mastered hesabı)
- `package.json` (jest dependency + script)

## BAŞARI KRİTERLERİ

1. `npm test` yeşil — tüm SM-2 senaryoları geçer.
2. Migration'ı çalıştırınca mevcut veride bozulma yok; yeni alanlar default değerlerle dolar.
3. Flashcard ekranında 4 buton + interval preview çalışır.
4. Dashboard'da "Bugün Gözden Geçir" kartı doğru sayıyı gösterir.
5. 5 yeni kelime ekleyip 4 kez `good` derecelendirildiğinde interval'lar yaklaşık `1d → 6d → 15d → 37d` çıkar.
6. `again` cevabından sonra kelime 10 dakika içinde tekrar due olur.
7. TypeScript hatasız derlenir, runtime hatası yok.

## ÖNCE YAP

İşe başlamadan önce şu üç dosyayı oku ve mimariyi anladığını kısa bir özetle bana doğrula:

1. `app/(tabs)/flashcards.tsx`
2. `lib/data.ts`
3. `hooks/useWordTip.ts`

Sonra plan ver, onayımı al, ondan sonra kod yaz. Tek seferde dev bir PR atma — adım adım, her dosyada commit yap.
