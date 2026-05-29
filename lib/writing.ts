// Lexify · Writing data layer
// Backs the IELTS-style writing module.
//
// Storage strategy:
//   • Signed-in users → Supabase table `writing_tasks` (see migration 0005)
//   • Guest mode      → AsyncStorage under `writing_drafts_guest_v1`
//
// We snapshot the prompt onto each task at creation time so the user's
// text stays tied to the exact wording they saw, even if the prompt
// library is updated later.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'
import { isGuestMode } from './guest'
import {
  WritingPrompt,
  PromptType,
  countWords,
} from './writingPrompts'

const GUEST_KEY = 'writing_drafts_guest_v1'

export class WritingAuthRequiredError extends Error {
  constructor() {
    super('Bu yazı özelliğini bulutta senkronlamak için giriş yapmalısın.')
    this.name = 'WritingAuthRequiredError'
  }
}

// Local auth helper — short timeout, never throws.
// If Supabase auth is unreachable (paused project, network, expired refresh
// token, etc.) we just return null and let the caller fall back to guest
// storage or surface a NotSignedInError. We avoid `flashcards.ts`'s
// `getCurrentUserId` because its error mapper says "Flashcard isteği"
// which is misleading inside the Writing module.
async function getAuthUid(): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    const sessionPromise = supabase.auth.getSession().then(
      ({ data }) => data?.session?.user?.id ?? null,
      () => null,
    )
    const timeoutPromise = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), 6000)
    })
    return await Promise.race([sessionPromise, timeoutPromise])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export type WritingStatus = 'draft' | 'completed'

export type WritingTask = {
  id: string
  user_id: string | null   // null for guest rows
  prompt_id: string
  prompt_type: PromptType
  prompt_category: string
  prompt_title: string
  prompt_body: string
  target_words: number
  suggested_minutes: number
  title: string
  content: string
  word_count: number
  duration_seconds: number
  status: WritingStatus
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Error mapping
// ─────────────────────────────────────────────────────────────────────────────

function mapWritingError(error: unknown, fallback = 'Writing isteği başarısız oldu.'): Error {
  const message = error instanceof Error ? error.message : String(error ?? fallback)
  if (message.includes("Could not find the table 'public.writing_tasks'")) {
    return new Error(
      'writing_tasks tablosu bulunamadı. supabase/migrations/0005_writing_tasks.sql migrationını çalıştırıp schema cache yenilemelisin.',
    )
  }
  if (message.toLowerCase().includes('timed out')) {
    return new Error('Bağlantı zaman aşımına uğradı. İnternet bağlantını kontrol et.')
  }
  return error instanceof Error ? error : new Error(message || fallback)
}

async function withTimeout<T>(p: PromiseLike<T>, ms = 12000, label = 'İstek'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
      }),
    ])
  } catch (e) {
    throw mapWritingError(e, `${label} başarısız oldu.`)
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest storage
// ─────────────────────────────────────────────────────────────────────────────

async function readGuestDrafts(): Promise<WritingTask[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as WritingTask[]
  } catch {
    return []
  }
}

async function writeGuestDrafts(rows: WritingTask[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_KEY, JSON.stringify(rows))
  } catch {
    // best-effort; ignore
  }
}

async function upsertLocalDraft(row: WritingTask): Promise<void> {
  const rows = await readGuestDrafts()
  const idx = rows.findIndex((item) => item.id === row.id)
  if (idx >= 0) rows[idx] = row
  else rows.unshift(row)
  await writeGuestDrafts(rows)
}

async function upsertLocalDrafts(rowsToMerge: WritingTask[]): Promise<void> {
  if (!rowsToMerge.length) return
  const rows = await readGuestDrafts()
  const byId = new Map(rows.map((row) => [row.id, row] as const))
  for (const row of rowsToMerge) byId.set(row.id, row)
  await writeGuestDrafts(Array.from(byId.values()))
}

function nowIso(): string {
  return new Date().toISOString()
}

function makeGuestId(): string {
  // RFC4122-ish but cheap; doesn't need to be a real UUID for local use.
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 10)
  return `local-${t}-${r}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function listWritingTasks(): Promise<WritingTask[]> {
  // Guest mode first — works offline / when Supabase auth is unreachable.
  if (await isGuestMode()) {
    const rows = await readGuestDrafts()
    return [...rows].sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
  }

  const uid = await getAuthUid()
  if (!uid) {
    const rows = await readGuestDrafts()
    return [...rows].sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
  }

  const { data, error } = await withTimeout(
    supabase
      .from('writing_tasks')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false }),
    12000,
    'Writing listesi',
  )
  if (error) throw mapWritingError(error)
  const rows = (data ?? []) as WritingTask[]
  await upsertLocalDrafts(rows)
  return rows
}

export async function getWritingTask(id: string): Promise<WritingTask | null> {
  // Guest rows are local-only, with id prefix 'local-'
  if ((await isGuestMode()) || id.startsWith('local-')) {
    const rows = await readGuestDrafts()
    return rows.find((r) => r.id === id) ?? null
  }

  const uid = await getAuthUid()
  if (!uid) {
    const rows = await readGuestDrafts()
    return rows.find((r) => r.id === id) ?? null
  }

  const { data, error } = await withTimeout(
    supabase.from('writing_tasks').select('*').eq('id', id).eq('user_id', uid).maybeSingle(),
    12000,
    'Writing kaydı',
  )
  if (error) throw mapWritingError(error)
  const row = (data as WritingTask) ?? null
  if (row) await upsertLocalDraft(row)
  return row
}

export async function createWritingDraft(prompt: WritingPrompt): Promise<WritingTask> {
  const guest = await isGuestMode()
  const uid = guest ? null : await getAuthUid()

  const base = {
    prompt_id: prompt.id,
    prompt_type: prompt.type,
    prompt_category: prompt.category,
    prompt_title: prompt.title,
    prompt_body: prompt.body,
    target_words: prompt.targetWords,
    suggested_minutes: prompt.suggestedMinutes,
    title: '',
    content: '',
    word_count: 0,
    duration_seconds: 0,
    status: 'draft' as WritingStatus,
  }

  if (guest || !uid) {
    const row: WritingTask = {
      id: makeGuestId(),
      user_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      ...base,
    }
    const rows = await readGuestDrafts()
    rows.unshift(row)
    await writeGuestDrafts(rows)
    return row
  }

  const { data, error } = await withTimeout(
    supabase
      .from('writing_tasks')
      .insert({ user_id: uid, ...base })
      .select()
      .single(),
    12000,
    'Yeni taslak',
  )
  if (error) throw mapWritingError(error)
  const row = data as WritingTask
  await upsertLocalDraft(row)
  return row
}

export type WritingPatch = {
  title?: string
  content?: string
  duration_seconds?: number
  status?: WritingStatus
}

export async function updateWritingTask(id: string, patch: WritingPatch): Promise<WritingTask> {
  const next: Partial<WritingTask> = { ...patch }
  if (typeof patch.content === 'string') {
    next.word_count = countWords(patch.content)
  }

  // Local rows always go through AsyncStorage, even if user later signs in.
  if ((await isGuestMode()) || id.startsWith('local-')) {
    const rows = await readGuestDrafts()
    const idx = rows.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('Taslak bulunamadı.')
    const updated: WritingTask = {
      ...rows[idx],
      ...next,
      updated_at: nowIso(),
    }
    rows[idx] = updated
    await writeGuestDrafts(rows)
    return updated
  }

  const uid = await getAuthUid()
  if (!uid) {
    const rows = await readGuestDrafts()
    const idx = rows.findIndex((r) => r.id === id)
    if (idx < 0) throw new Error('Taslak bulunamadı.')
    const updated: WritingTask = {
      ...rows[idx],
      ...next,
      updated_at: nowIso(),
    }
    rows[idx] = updated
    await writeGuestDrafts(rows)
    return updated
  }

  const { data, error } = await withTimeout(
    supabase
      .from('writing_tasks')
      .update(next)
      .eq('id', id)
      .eq('user_id', uid)
      .select()
      .single(),
    12000,
    'Taslak güncelleme',
  )
  if (error) throw mapWritingError(error)
  const row = data as WritingTask
  await upsertLocalDraft(row)
  return row
}

export async function deleteWritingTask(id: string): Promise<void> {
  if ((await isGuestMode()) || id.startsWith('local-')) {
    const rows = await readGuestDrafts()
    const next = rows.filter((r) => r.id !== id)
    await writeGuestDrafts(next)
    return
  }

  const uid = await getAuthUid()
  if (!uid) {
    const rows = await readGuestDrafts()
    const next = rows.filter((r) => r.id !== id)
    await writeGuestDrafts(next)
    return
  }

  const { error } = await withTimeout(
    supabase.from('writing_tasks').delete().eq('id', id).eq('user_id', uid),
    12000,
    'Taslak silme',
  )
  if (error) throw mapWritingError(error)
  const rows = await readGuestDrafts()
  const next = rows.filter((r) => r.id !== id)
  await writeGuestDrafts(next)
}

// Convenience – count completed tasks for the dashboard / study screen.
export async function countCompletedWritingTasks(): Promise<number> {
  try {
    const list = await listWritingTasks()
    return list.filter((t) => t.status === 'completed').length
  } catch {
    return 0
  }
}
