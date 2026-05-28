import { Grade, SrsState, Stage, applyGrade } from './srs'

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
  mastered?: boolean
  review_count?: number
  created_at?: string
  ease: number
  interval_days: number
  repetitions: number
  lapses: number
  due_at: string
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

export interface DueCount {
  due: number
  newWords: number
  learning: number
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`API ${path} failed: ${res.status} ${err}`)
  }
  return res.json()
}

function post<T>(path: string, body: unknown) {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

function patch<T>(path: string, body: unknown) {
  return api<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
}

async function del(path: string) {
  await api(path, { method: 'DELETE' })
}

// ── Saved words ──────────────────────────────────────────────────────────────
export async function listSavedWords(options?: {
  limit?: number
  orderBy?: 'created_at' | 'review_count' | 'due_at' | 'repetitions'
  ascending?: boolean
  search?: string
}): Promise<SavedWord[]> {
  const params = new URLSearchParams()
  if (options?.search) params.set('search', options.search)
  if (options?.orderBy) params.set('orderBy', options.orderBy)
  if (options?.ascending !== undefined) params.set('ascending', String(options.ascending))
  if (options?.limit) params.set('limit', String(options.limit))
  const qs = params.toString()
  return api<SavedWord[]>(`/api/saved-words${qs ? '?' + qs : ''}`)
}

export async function listUniqueSavedWords(options?: Parameters<typeof listSavedWords>[0]): Promise<SavedWord[]> {
  const words = await listSavedWords(options)
  return words.filter((word, index, arr) =>
    arr.findIndex(item => item.word.toLowerCase() === word.word.toLowerCase()) === index
  )
}

export async function deleteSavedWord(id: string): Promise<void> {
  await del(`/api/saved-words/${id}`)
}

export async function deleteSavedWordByWord(word: string): Promise<void> {
  await del(`/api/saved-words/by-word/${encodeURIComponent(word)}`)
}

export async function upsertSavedWord(payload: {
  word: string
  translation?: string
  context?: string
  ipa?: string
  cefr?: string
  source_title?: string
  source_url?: string
  source_type?: string
}): Promise<SavedWord | null> {
  try {
    return await post<SavedWord>('/api/saved-words', payload)
  } catch (e) {
    console.warn('[dataApi] upsertSavedWord failed:', e)
    return null
  }
}

// ── SRS ──────────────────────────────────────────────────────────────────────
export async function listDueWords(limit = 20): Promise<SavedWord[]> {
  return api<SavedWord[]>(`/api/due-words?limit=${limit}`)
}

export async function listNewWords(limit = 5): Promise<SavedWord[]> {
  return api<SavedWord[]>(`/api/new-words?limit=${limit}`)
}

export async function getDueCount(): Promise<DueCount> {
  try {
    return await api<DueCount>('/api/due-count')
  } catch {
    return { due: 0, newWords: 0, learning: 0 }
  }
}

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

export function srsStateOf(word: SavedWord): SrsState {
  return toSrsState(word)
}

export async function gradeWord(word: SavedWord, grade: Grade): Promise<SavedWord | null> {
  try {
    const now = new Date()
    const next = applyGrade(toSrsState(word), grade, now)
    return await patch<SavedWord>(`/api/saved-words/${word.id}/grade`, {
      ease: next.ease,
      interval_days: next.interval,
      repetitions: next.repetitions,
      lapses: next.lapses,
      due_at: next.dueAt.toISOString(),
      last_reviewed_at: now.toISOString(),
      stage: next.stage,
    })
  } catch (e) {
    console.warn('[dataApi] gradeWord failed:', e)
    return null
  }
}

export async function updateSavedWordReview(word: SavedWord, result: 'know' | 'dontknow'): Promise<void> {
  await gradeWord(word, result === 'know' ? 'good' : 'again')
}

// ── Stats ────────────────────────────────────────────────────────────────────
export async function getStats() {
  try {
    return await api<{ total: number; mastered: number; today: number; week: number; streak: number }>('/api/stats')
  } catch {
    return { total: 0, mastered: 0, today: 0, week: 0, streak: 0 }
  }
}

// ── Reading history ──────────────────────────────────────────────────────────
export async function listReadingHistory(): Promise<ReadingHistoryItem[]> {
  try {
    return await api<ReadingHistoryItem[]>('/api/reading-history')
  } catch {
    return []
  }
}

export async function addReadingHistory(payload: { title?: string; url?: string; word_count?: number }): Promise<void> {
  try {
    await post('/api/reading-history', payload)
  } catch (e) {
    console.warn('[dataApi] addReadingHistory failed:', e)
  }
}

export async function deleteReadingHistoryItem(id: string): Promise<void> {
  await del(`/api/reading-history/${id}`)
}

// ── Collections ──────────────────────────────────────────────────────────────
export async function listCollections(): Promise<CollectionItem[]> {
  try {
    return await api<CollectionItem[]>('/api/collections')
  } catch {
    return []
  }
}

export async function createCollection(name: string): Promise<CollectionItem | null> {
  try {
    return await post<CollectionItem>('/api/collections', { name })
  } catch {
    return null
  }
}

export async function deleteCollectionById(id: string): Promise<void> {
  await del(`/api/collections/${id}`)
}

export async function listWordsForCollection(collectionId: string): Promise<SavedWord[]> {
  try {
    return await api<SavedWord[]>(`/api/collections/${collectionId}/words`)
  } catch {
    return []
  }
}

export type { Grade, Stage }
