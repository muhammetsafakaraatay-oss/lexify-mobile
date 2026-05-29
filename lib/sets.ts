/**
 * Study Set data layer — set-scoped flashcard collections.
 *
 * Sets reference SavedWord.id values (no duplication of word data); when a
 * SavedWord is updated/deleted in lib/data, the set automatically reflects it
 * via the `populateSet` helper which joins by id.
 *
 * Storage: AsyncStorage (offline-first). Future: mirror to Supabase.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { listSavedWords, type SavedWord } from './data'

const STORAGE_KEY = 'lexify_study_sets_v1'

export type SetMode = 'flashcards' | 'learn' | 'match' | 'spell' | 'test'

export interface StudySet {
  id: string
  name: string
  description?: string
  termIds: string[]
  /** termId → mastery in [0..1]. 1 = mastered within this set. */
  mastery: Record<string, number>
  /** Best Match-mode completion time in seconds (lower = better). */
  bestMatchSeconds?: number
  createdAt: string
  updatedAt: string
}

export interface PopulatedSet extends StudySet {
  terms: SavedWord[]
  masteredCount: number
  learningCount: number
}

function makeId(): string {
  return 'set_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

async function readAll(): Promise<StudySet[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.warn('[sets] read failed', err)
    return []
  }
}

async function writeAll(sets: StudySet[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sets))
}

export async function listSets(): Promise<StudySet[]> {
  const all = await readAll()
  return all.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
}

export async function getSet(id: string): Promise<StudySet | null> {
  const all = await readAll()
  return all.find((s) => s.id === id) ?? null
}

export async function createSet(input: {
  name: string
  description?: string
  termIds: string[]
}): Promise<StudySet> {
  const now = new Date().toISOString()
  const set: StudySet = {
    id: makeId(),
    name: input.name.trim() || 'Adsız Set',
    description: input.description?.trim() || undefined,
    termIds: Array.from(new Set(input.termIds)),
    mastery: {},
    createdAt: now,
    updatedAt: now,
  }
  const all = await readAll()
  all.push(set)
  await writeAll(all)
  return set
}

export async function updateSet(
  id: string,
  patch: Partial<Pick<StudySet, 'name' | 'description' | 'termIds'>>,
): Promise<StudySet | null> {
  const all = await readAll()
  const idx = all.findIndex((s) => s.id === id)
  if (idx < 0) return null
  const next: StudySet = {
    ...all[idx],
    ...patch,
    termIds: patch.termIds ? Array.from(new Set(patch.termIds)) : all[idx].termIds,
    updatedAt: new Date().toISOString(),
  }
  all[idx] = next
  await writeAll(all)
  return next
}

export async function deleteSet(id: string): Promise<void> {
  const all = await readAll()
  const filtered = all.filter((s) => s.id !== id)
  if (filtered.length === all.length) return
  await writeAll(filtered)
}

/** Update mastery for a single term in a set. Clamped to [0,1]. */
export async function bumpMastery(
  setId: string,
  termId: string,
  delta: number,
): Promise<void> {
  const all = await readAll()
  const idx = all.findIndex((s) => s.id === setId)
  if (idx < 0) return
  const current = all[idx].mastery[termId] ?? 0
  const next = Math.max(0, Math.min(1, current + delta))
  all[idx] = {
    ...all[idx],
    mastery: { ...all[idx].mastery, [termId]: next },
    updatedAt: new Date().toISOString(),
  }
  await writeAll(all)
}

/** Reset all mastery for a set (used by "Restart" buttons). */
export async function resetMastery(setId: string): Promise<void> {
  const all = await readAll()
  const idx = all.findIndex((s) => s.id === setId)
  if (idx < 0) return
  all[idx] = { ...all[idx], mastery: {}, updatedAt: new Date().toISOString() }
  await writeAll(all)
}

export async function recordMatchTime(setId: string, seconds: number): Promise<void> {
  const all = await readAll()
  const idx = all.findIndex((s) => s.id === setId)
  if (idx < 0) return
  const prev = all[idx].bestMatchSeconds
  if (prev === undefined || seconds < prev) {
    all[idx] = {
      ...all[idx],
      bestMatchSeconds: Math.round(seconds * 10) / 10,
      updatedAt: new Date().toISOString(),
    }
    await writeAll(all)
  }
}

/**
 * Join a set with its SavedWord rows. Drops termIds that no longer exist.
 * If `set` is null, returns null.
 */
export async function populateSet(set: StudySet | null): Promise<PopulatedSet | null> {
  if (!set) return null
  const allWords = await listSavedWords()
  const byId = new Map(allWords.map((w) => [w.id, w]))
  const terms: SavedWord[] = []
  for (const id of set.termIds) {
    const w = byId.get(id)
    if (w) terms.push(w)
  }
  const masteredCount = terms.filter((t) => (set.mastery[t.id] ?? 0) >= 1).length
  const learningCount = terms.length - masteredCount
  return { ...set, terms, masteredCount, learningCount }
}

/** Mastery summary across all sets — for the index screen. */
export async function summariseSet(set: StudySet): Promise<{
  termCount: number
  masteredCount: number
}> {
  const termCount = set.termIds.length
  const masteredCount = set.termIds.filter((id) => (set.mastery[id] ?? 0) >= 1).length
  return { termCount, masteredCount }
}
