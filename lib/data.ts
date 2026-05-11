import { supabase } from './supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  Grade,
  SrsState,
  Stage,
  applyGrade,
} from './srs'

const GUEST_SAVED_WORDS_KEY = 'guest_saved_words_v1'

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
    source_type: word.source_type,
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
    example: input.example,
    ipa: input.ipa,
    cefr: input.cefr,
    source_title: input.source_title,
    source_url: input.source_url,
    source_type: input.source_type,
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

  return data as SavedWord
}

export function dedupeWords(words: SavedWord[]): SavedWord[] {
  return words.filter((word, index, arr) =>
    arr.findIndex((item) => item.word.toLowerCase() === word.word.toLowerCase()) === index
  )
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
    query = query.or(`word.ilike.%${options.search}%,translation.ilike.%${options.search}%`)
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
  if (!userId) return []

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
