import { supabase } from './supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { callLLM } from './ai/llmClient'
import {
  Grade,
  SrsState,
  Stage,
  applyGrade,
} from './srs'

const GUEST_SAVED_WORDS_KEY = 'guest_saved_words_v1'
const GUEST_READING_HISTORY_KEY = 'guest_reading_history_v1'
const MAX_GUEST_HISTORY = 30

export interface SavedWord {
  id: string
  user_id: string
  word: string
  translation?: string
  context?: string
  example?: string
  ipa?: string
  cefr?: string
  source_title?: string
  source_url?: string
  source_type?: string
  context_sentence?: string
  context_paragraph?: string
  cefr_level?: string
  topic_tags?: string[]
  saved_at?: string
  last_seen_in_reading_at?: string
  /** @deprecated `stage === 'mastered'` kullanın. Geriye uyum için tutuluyor. */
  mastered?: boolean
  /** @deprecated `repetitions` kullanın. Geriye uyum için tutuluyor. */
  review_count?: number
  created_at?: string

  // SRS alanları (migration 0001_srs.sql ile eklendi)
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at: string // ISO string
  last_reviewed_at: string | null
  stage: Stage
}

const TOPIC_TAGS = [
  'technology',
  'business',
  'science',
  'politics',
  'sports',
  'culture',
  'health',
  'environment',
  'lifestyle',
  'general',
] as const

function hashText(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

function normalizeTopicTags(value: unknown): string[] {
  if (!Array.isArray(value)) return ['general']
  const allowed = new Set<string>(TOPIC_TAGS)
  const tags = value
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => allowed.has(item))
  return tags.length ? Array.from(new Set(tags)).slice(0, 3) : ['general']
}

async function classifyWordTopics(params: {
  userId?: string
  word: string
  contextSentence: string
}): Promise<string[]> {
  const sentence = params.contextSentence.trim()
  if (!sentence) return ['general']

  const cacheKey = `topic:${hashText(`${params.word.toLowerCase()}::${sentence.toLowerCase()}`)}`
  const prompt = [
    'You are a content classifier.',
    `Sentence: "${sentence}"`,
    `Target word: "${params.word}"`,
    `Allowed tags: ${TOPIC_TAGS.join(', ')}`,
    'Return strict JSON: {"tags":["tag1","tag2"]}',
  ].join('\n')

  const response = await callLLM({
    feature: 'topic_classify',
    userId: params.userId,
    model: 'gpt-4o-mini',
    cacheKey,
    cacheTTL: 60 * 60 * 24 * 30,
    maxRetries: 1,
    messages: [
      {
        role: 'system',
        content: 'Return only JSON with tags from allowed list.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  try {
    const parsed = JSON.parse(response.content)
    return normalizeTopicTags(parsed?.tags)
  } catch {
    return ['general']
  }
}

export interface ReadingHistoryItem {
  id: string
  user_id: string
  title?: string
  url?: string
  word_count?: number
  created_at: string
}

export interface CollectionItem {
  id: string
  user_id?: string
  name: string
  emoji?: string
}

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Supabase `.or()` ham filtre string'i bekler. Virgül/parantez ayraç olduğundan
 * arama girdisi içlerinde geçerse query parse kırılır; ayrıca %/_ ilike wildcard'ı.
 * Burada hem virgül/parantezi temizliyor hem ilike meta karakterlerini kaçırıyoruz.
 */
function escapeIlikePattern(input: string): string {
  return input
    // virgül ve parantez Supabase or() ayraçlarıdır — basitçe kaldır
    .replace(/[(),]/g, ' ')
    // ilike wildcard'larını kaçır
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim()
}

async function readGuestSavedWords(): Promise<SavedWord[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_SAVED_WORDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as SavedWord[] : []
  } catch (error) {
    console.warn('[data] readGuestSavedWords failed:', error)
    return []
  }
}

async function writeGuestSavedWords(words: SavedWord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_SAVED_WORDS_KEY, JSON.stringify(words))
  } catch (error) {
    console.warn('[data] writeGuestSavedWords failed:', error)
  }
}

function ensureGuestSavedWordDefaults(word: Partial<SavedWord> & Pick<SavedWord, 'word'>): SavedWord {
  const now = new Date().toISOString()
  const normalized = word.word.trim()
  const id = word.id ?? `guest-${normalized.toLowerCase()}`

  return {
    id,
    user_id: word.user_id ?? 'guest',
    word: normalized,
    translation: word.translation,
    context: word.context,
    example: word.example,
    ipa: word.ipa,
    cefr: word.cefr,
    source_title: word.source_title,
    source_url: word.source_url,
    source_type: word.source_type ?? 'legacy',
    context_sentence: word.context_sentence ?? word.context,
    context_paragraph: word.context_paragraph,
    cefr_level: word.cefr_level ?? word.cefr,
    topic_tags: word.topic_tags ?? ['general'],
    saved_at: word.saved_at ?? now,
    last_seen_in_reading_at: word.last_seen_in_reading_at,
    mastered: word.mastered ?? false,
    review_count: word.review_count ?? 0,
    created_at: word.created_at ?? now,
    ease: word.ease ?? 2.5,
    interval_days: word.interval_days ?? 0,
    repetitions: word.repetitions ?? 0,
    lapses: word.lapses ?? 0,
    due_at: word.due_at ?? now,
    last_reviewed_at: word.last_reviewed_at ?? null,
    stage: word.stage ?? 'new',
  }
}

export async function upsertSavedWord(input: Partial<SavedWord> & Pick<SavedWord, 'word'>): Promise<SavedWord | null> {
  const userId = await getCurrentUserId()

  if (!userId) {
    const words = await readGuestSavedWords()
    const candidate = ensureGuestSavedWordDefaults({ ...input, user_id: 'guest' })
    const existingIndex = words.findIndex((item) => item.word.toLowerCase() === candidate.word.toLowerCase())
    const next = [...words]

    if (existingIndex >= 0) {
      next[existingIndex] = {
        ...next[existingIndex],
        ...candidate,
        id: next[existingIndex].id,
        created_at: next[existingIndex].created_at ?? candidate.created_at,
      }
      await writeGuestSavedWords(next)
      return next[existingIndex]
    }

    next.unshift(candidate)
    await writeGuestSavedWords(next)
    return candidate
  }

  const payload = {
    user_id: userId,
    word: input.word,
    translation: input.translation,
    context: input.context,
    context_sentence: input.context_sentence ?? input.context,
    context_paragraph: input.context_paragraph,
    example: input.example,
    ipa: input.ipa,
    cefr: input.cefr,
    cefr_level: input.cefr_level ?? input.cefr,
    source_title: input.source_title,
    source_url: input.source_url,
    source_type: input.source_type ?? 'legacy',
    topic_tags: input.topic_tags,
  }

  const { data, error } = await supabase
    .from('saved_words')
    .upsert(payload, { onConflict: 'user_id,word' })
    .select()
    .single()

  if (error) {
    console.warn('[data] upsertSavedWord failed:', error.message)
    return null
  }

  const saved = data as SavedWord

  // Faz 0.3: Kayıt sonrası asenkron tema sınıflandırma.
  const contextSentence = saved.context_sentence || saved.context || input.context || ''
  if (contextSentence && (!saved.topic_tags || saved.topic_tags.length === 0)) {
    void (async () => {
      try {
        const tags = await classifyWordTopics({
          userId,
          word: saved.word,
          contextSentence,
        })
        await supabase
          .from('saved_words')
          .update({ topic_tags: tags })
          .eq('id', saved.id)
          .eq('user_id', userId)
      } catch (topicError: any) {
        console.warn('[data] topic classification failed:', topicError?.message || topicError)
      }
    })()
  }

  return saved
}

export function dedupeWords(words: SavedWord[]): SavedWord[] {
  return words.filter((word, index, arr) =>
    arr.findIndex((item) => item.word.toLowerCase() === word.word.toLowerCase()) === index
  )
}

/**
 * Misafir modunda kaydedilen kelimeleri giriş sonrası Supabase hesabına taşır.
 */
export async function mergeGuestWordsIntoAccount(): Promise<{ merged: number }> {
  const userId = await getCurrentUserId()
  if (!userId) return { merged: 0 }

  const guestWords = await readGuestSavedWords()
  if (guestWords.length === 0) return { merged: 0 }

  let merged = 0
  for (const gw of guestWords) {
    const normalized = gw.word.trim()
    if (!normalized) continue

    const { error } = await supabase
      .from('saved_words')
      .upsert(
        {
          user_id: userId,
          word: normalized,
          translation: gw.translation,
          context: gw.context,
          context_sentence: gw.context_sentence ?? gw.context,
          context_paragraph: gw.context_paragraph,
          example: gw.example,
          ipa: gw.ipa,
          cefr: gw.cefr,
          cefr_level: gw.cefr_level ?? gw.cefr,
          source_title: gw.source_title,
          source_url: gw.source_url,
          source_type: gw.source_type ?? 'legacy',
          topic_tags: gw.topic_tags ?? ['general'],
          saved_at: gw.saved_at ?? gw.created_at ?? new Date().toISOString(),
          last_seen_in_reading_at: gw.last_seen_in_reading_at ?? null,
          ease: gw.ease ?? 2.5,
          interval_days: gw.interval_days ?? 0,
          repetitions: gw.repetitions ?? 0,
          lapses: gw.lapses ?? 0,
          due_at: gw.due_at ?? new Date().toISOString(),
          last_reviewed_at: gw.last_reviewed_at,
          stage: gw.stage ?? 'new',
        },
        { onConflict: 'user_id,word' },
      )

    if (!error) merged++
    else console.warn('[data] mergeGuestWords failed for', normalized, error.message)
  }

  await writeGuestSavedWords([])
  return { merged }
}

async function readGuestReadingHistory(): Promise<ReadingHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_READING_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ReadingHistoryItem[]) : []
  } catch {
    return []
  }
}

async function writeGuestReadingHistory(items: ReadingHistoryItem[]): Promise<void> {
  await AsyncStorage.setItem(GUEST_READING_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_GUEST_HISTORY)))
}

export async function upsertReadingHistory(input: {
  url?: string
  title: string
  word_count?: number
}): Promise<void> {
  const userId = await getCurrentUserId()
  const title = input.title.trim() || 'Okuma'
  const now = new Date().toISOString()

  if (!userId) {
    const list = await readGuestReadingHistory()
    const existingIdx = input.url
      ? list.findIndex((h) => h.url === input.url)
      : -1
    const item: ReadingHistoryItem = {
      id: existingIdx >= 0 ? list[existingIdx].id : `guest-h-${Date.now()}`,
      user_id: 'guest',
      title,
      url: input.url,
      word_count: input.word_count,
      created_at: now,
    }
    const next = existingIdx >= 0
      ? [item, ...list.filter((_, i) => i !== existingIdx)]
      : [item, ...list]
    await writeGuestReadingHistory(next)
    return
  }

  const { error } = await supabase.from('reading_history').insert({
    user_id: userId,
    url: input.url ?? null,
    title,
    word_count: input.word_count ?? null,
  })
  if (error) console.warn('[data] upsertReadingHistory failed:', error.message)
}

export async function mergeGuestReadingHistoryIntoAccount(): Promise<{ merged: number }> {
  const userId = await getCurrentUserId()
  if (!userId) return { merged: 0 }

  const guestItems = await readGuestReadingHistory()
  if (guestItems.length === 0) return { merged: 0 }

  let merged = 0
  for (const item of guestItems) {
    const { error } = await supabase.from('reading_history').insert({
      user_id: userId,
      url: item.url ?? null,
      title: item.title ?? 'Okuma',
      word_count: item.word_count ?? null,
    })
    if (!error) merged++
  }

  await writeGuestReadingHistory([])
  return { merged }
}

/** Misafir kelime + okuma geçmişini tek seferde hesaba taşır */
export async function mergeGuestDataIntoAccount(): Promise<{ words: number; history: number }> {
  const [words, history] = await Promise.all([
    mergeGuestWordsIntoAccount(),
    mergeGuestReadingHistoryIntoAccount(),
  ])
  return { words: words.merged, history: history.merged }
}

// ──────────────────────────────────────────────────────────────────────────
// Listeleme
// ──────────────────────────────────────────────────────────────────────────

export async function listSavedWords(options?: {
  limit?: number
  orderBy?: 'created_at' | 'review_count' | 'due_at' | 'repetitions'
  ascending?: boolean
  search?: string
}): Promise<SavedWord[]> {
  const userId = await getCurrentUserId()
  if (!userId) {
    let localWords = await readGuestSavedWords()
    if (options?.search) {
      const q = options.search.toLowerCase()
      localWords = localWords.filter((item) =>
        item.word.toLowerCase().includes(q) ||
        (item.translation ?? '').toLowerCase().includes(q)
      )
    }

    const orderBy = options?.orderBy ?? 'created_at'
    const direction = options?.ascending ? 1 : -1
    localWords = [...localWords].sort((a, b) => {
      const av = String((a as any)[orderBy] ?? '')
      const bv = String((b as any)[orderBy] ?? '')
      return av.localeCompare(bv) * direction
    })

    if (options?.limit) localWords = localWords.slice(0, options.limit)
    return localWords
  }

  let query = supabase
    .from('saved_words')
    .select('*')
    .eq('user_id', userId)

  if (options?.search) {
    // Supabase .or() string'inde virgül/parantez ayraçtır; ayrıca %, _ ve \ ilike wildcard'ı.
    // Kullanıcı girdisini kaçırmadan geçirmek desen kırılmasına yol açar.
    const escaped = escapeIlikePattern(options.search)
    query = query.or(`word.ilike.%${escaped}%,translation.ilike.%${escaped}%`)
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? false })
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) {
    console.warn('[data] listSavedWords failed:', error.message)
    return []
  }
  return (data ?? []) as SavedWord[]
}

export async function listUniqueSavedWords(options?: {
  limit?: number
  orderBy?: 'created_at' | 'review_count' | 'due_at' | 'repetitions'
  ascending?: boolean
  search?: string
}): Promise<SavedWord[]> {
  return dedupeWords(await listSavedWords(options))
}

export async function deleteSavedWord(id: string): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) {
    const words = await readGuestSavedWords()
    await writeGuestSavedWords(words.filter((word) => word.id !== id))
    return
  }
  const { error } = await supabase.from('saved_words').delete().eq('id', id)
  if (error) console.warn('[data] deleteSavedWord failed:', error.message)
}

export async function markSavedWordsSeenInReading(wordIds: string[]): Promise<void> {
  const ids = Array.from(new Set(wordIds.filter(Boolean)))
  if (!ids.length) return

  const userId = await getCurrentUserId()
  const now = new Date().toISOString()

  if (!userId) {
    const words = await readGuestSavedWords()
    const next = words.map((item) =>
      ids.includes(item.id)
        ? { ...item, last_seen_in_reading_at: now }
        : item,
    )
    await writeGuestSavedWords(next)
    return
  }

  const { error } = await supabase
    .from('saved_words')
    .update({ last_seen_in_reading_at: now })
    .eq('user_id', userId)
    .in('id', ids)

  if (error) console.warn('[data] markSavedWordsSeenInReading failed:', error.message)
}

// ──────────────────────────────────────────────────────────────────────────
// SRS
// ──────────────────────────────────────────────────────────────────────────

/**
 * Bugün gözden geçirilmesi gereken kelimeler — SRS sırasına göre.
 * `due_at <= now` filtresi + en eski due ilk gelir.
 */
export async function listDueWords(limit = 20): Promise<SavedWord[]> {
  const userId = await getCurrentUserId()
  if (!userId) {
    const now = new Date().toISOString()
    return (await readGuestSavedWords())
      .filter((item) => item.stage !== 'mastered' && item.due_at <= now)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))
      .slice(0, limit)
  }

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('saved_words')
    .select('*')
    .eq('user_id', userId)
    .neq('stage', 'mastered')
    .lte('due_at', now)
    .order('due_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.warn('[data] listDueWords failed:', error.message)
    return []
  }
  return (data ?? []) as SavedWord[]
}

/**
 * Henüz hiç review edilmemiş "yeni" kelimeler.
 * Eklenme tarihine göre eski → yeni (önce kayıt edilen önce öğrenilsin mantığı).
 */
export async function listNewWords(limit = 5): Promise<SavedWord[]> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return (await readGuestSavedWords())
      .filter((item) => item.stage === 'new')
      .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
      .slice(0, limit)
  }

  const { data, error } = await supabase
    .from('saved_words')
    .select('*')
    .eq('user_id', userId)
    .eq('stage', 'new')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.warn('[data] listNewWords failed:', error.message)
    return []
  }
  return (data ?? []) as SavedWord[]
}

export interface DueCount {
  due: number       // şu an due olan (review + learning + leech)
  newWords: number  // hiç çalışılmamış
  learning: number  // öğrenme aşamasında
}

/**
 * Dashboard için sayım. head: true ile satır taşınmaz.
 */
export async function getDueCount(): Promise<DueCount> {
  const userId = await getCurrentUserId()
  if (!userId) {
    const now = new Date().toISOString()
    const words = await readGuestSavedWords()
    return {
      due: words.filter((item) => item.stage !== 'mastered' && item.due_at <= now).length,
      newWords: words.filter((item) => item.stage === 'new').length,
      learning: words.filter((item) => item.stage === 'learning').length,
    }
  }

  const now = new Date().toISOString()

  const [dueRes, newRes, learningRes] = await Promise.all([
    supabase
      .from('saved_words')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('stage', 'mastered')
      .lte('due_at', now),
    supabase
      .from('saved_words')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('stage', 'new'),
    supabase
      .from('saved_words')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('stage', 'learning'),
  ])

  return {
    due: dueRes.count ?? 0,
    newWords: newRes.count ?? 0,
    learning: learningRes.count ?? 0,
  }
}

/**
 * SavedWord → SrsState dönüşümü. DB'den gelen veriyi engine'in beklediği şekle getirir.
 */
function toSrsState(word: SavedWord): SrsState {
  return {
    ease: word.ease ?? 2.5,
    interval: word.interval_days ?? 0,
    repetitions: word.repetitions ?? 0,
    lapses: word.lapses ?? 0,
    dueAt: word.due_at ? new Date(word.due_at) : new Date(),
    lastReviewedAt: word.last_reviewed_at ? new Date(word.last_reviewed_at) : null,
    stage: word.stage ?? 'new',
  }
}

/**
 * Salt-okunur engine girdisini hesaplamak için. UI preview'larda kullanılır.
 */
export function srsStateOf(word: SavedWord): SrsState {
  return toSrsState(word)
}

/**
 * Bir kelimeye grade ver, yeni state'i hesapla, DB'ye yaz, güncellenmiş kaydı döndür.
 *
 * Geriye dönük uyum: `stage='mastered'` olduğunda eski `mastered` boolean'ı da true yazılır.
 * Eski `review_count` alanı `repetitions` ile senkron tutulur.
 */
export async function gradeWord(word: SavedWord, grade: Grade): Promise<SavedWord | null> {
  const userId = await getCurrentUserId()

  const now = new Date()
  const next = applyGrade(toSrsState(word), grade, now)

  const update = {
    ease: next.ease,
    interval_days: next.interval,
    repetitions: next.repetitions,
    lapses: next.lapses,
    due_at: next.dueAt.toISOString(),
    last_reviewed_at: now.toISOString(),
    stage: next.stage,
    // legacy compat ↓
    mastered: next.stage === 'mastered',
    review_count: next.repetitions,
  }

  if (!userId) {
    const words = await readGuestSavedWords()
    const nextWord = {
      ...word,
      ...update,
    } as SavedWord
    const merged = words.map((item) => item.id === word.id ? nextWord : item)
    await writeGuestSavedWords(merged)
    return nextWord
  }

  const { data, error } = await supabase
    .from('saved_words')
    .update(update)
    .eq('id', word.id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.warn('[data] gradeWord failed:', error.message)
    return null
  }
  return data as SavedWord
}

/**
 * @deprecated `gradeWord` kullanın. Eski 2-buton flashcard akışı için bırakıldı.
 * 'know' → 'good', 'dontknow' → 'again' eşlemesi yapar.
 */
export async function updateSavedWordReview(
  word: SavedWord,
  result: 'know' | 'dontknow'
): Promise<void> {
  await gradeWord(word, result === 'know' ? 'good' : 'again')
}

// ──────────────────────────────────────────────────────────────────────────
// Reading history
// ──────────────────────────────────────────────────────────────────────────

export async function listReadingHistory(): Promise<ReadingHistoryItem[]> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return readGuestReadingHistory()
  }

  const { data, error } = await supabase
    .from('reading_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.warn('[data] listReadingHistory failed:', error.message)
    return []
  }
  return (data ?? []) as ReadingHistoryItem[]
}

export async function deleteReadingHistoryItem(id: string): Promise<void> {
  const userId = await getCurrentUserId()
  if (!userId) {
    const list = await readGuestReadingHistory()
    await writeGuestReadingHistory(list.filter((h) => h.id !== id))
    return
  }
  const { error } = await supabase.from('reading_history').delete().eq('id', id)
  if (error) console.warn('[data] deleteReadingHistoryItem failed:', error.message)
}

// ──────────────────────────────────────────────────────────────────────────
// Collections
// ──────────────────────────────────────────────────────────────────────────

export async function listCollections(): Promise<CollectionItem[]> {
  const userId = await getCurrentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.warn('[data] listCollections failed:', error.message)
    return []
  }
  return (data ?? []) as CollectionItem[]
}

export async function createCollection(name: string): Promise<CollectionItem | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const { data, error } = await supabase
    .from('collections')
    .insert({ user_id: userId, name })
    .select()
    .single()

  if (error) {
    console.warn('[data] createCollection failed:', error.message)
    return null
  }
  return data as CollectionItem
}

export async function deleteCollectionById(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) console.warn('[data] deleteCollectionById failed:', error.message)
}

export async function listWordsForCollection(collectionId: string): Promise<SavedWord[]> {
  const { data, error } = await supabase
    .from('collection_words')
    .select('word_id, saved_words(*)')
    .eq('collection_id', collectionId)

  if (error) {
    console.warn('[data] listWordsForCollection failed:', error.message)
    return []
  }
  // Supabase join sonucu: saved_words tek nesne ya da dizi olabiliyor; ikisini de tolere et.
  type Row = { saved_words: SavedWord | SavedWord[] | null }
  const rows = (data ?? []) as unknown as Row[]
  const flat: SavedWord[] = []
  for (const row of rows) {
    if (!row.saved_words) continue
    if (Array.isArray(row.saved_words)) flat.push(...row.saved_words)
    else flat.push(row.saved_words)
  }
  return flat
}

// Re-export SRS engine for convenience
export type { Grade, Stage } from './srs'
