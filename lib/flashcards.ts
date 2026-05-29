// Lexify Flashcards data layer (Supabase-backed Quizlet-style decks/cards)
// Tables: flashcard_decks, flashcard_cards (see supabase/migrations/0003_flashcards.sql)

import { supabase } from './supabase'

export type CardStatus = 'unseen' | 'known' | 'unknown'

export type FlashcardDeck = {
  id: string
  user_id: string
  title: string
  description: string | null
  source: 'manual' | 'vocab'
  vocab_list_id: string | null
  card_count: number
  created_at: string
  updated_at: string
}

export type FlashcardCard = {
  id: string
  deck_id: string
  user_id: string
  front: string
  back: string
  status: CardStatus
  last_reviewed_at: string | null
  created_at: string
}

export type DeckProgress = {
  total: number
  known: number
  unknown: number
  unseen: number
  percent: number
}

export type DeckWithProgress = FlashcardDeck & { progress: DeckProgress }

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────────────────────────────────

export class NotSignedInError extends Error {
  constructor() {
    super('Bu özelliği kullanmak için giriş yapmalısın.')
    this.name = 'NotSignedInError'
  }
}

function mapFlashcardsError(error: unknown, fallback = 'Flashcard verisi alınamadı.'): Error {
  const message = error instanceof Error ? error.message : String(error ?? fallback)

  if (
    message.includes("Could not find the table 'public.flashcard_decks'") ||
    message.includes("Could not find the table 'public.flashcard_cards'")
  ) {
    return new Error(
      'Flashcard tabloları bu Supabase projesinde bulunamadı. Uygulamanın bağlı olduğu projede 0003_flashcards.sql migrationını çalıştırıp schema cache yenilemelisin.',
    )
  }

  if (message.toLowerCase().includes('timed out')) {
    return new Error('Flashcard isteği zaman aşımına uğradı. İnternetini kontrol edip tekrar dene.')
  }

  return error instanceof Error ? error : new Error(message || fallback)
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 12000,
  label = 'İstek',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
      }),
    ])
  } catch (error) {
    throw mapFlashcardsError(error, `${label} başarısız oldu.`)
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await withTimeout(supabase.auth.getSession(), 8000, 'Oturum kontrolü')
  return session?.user?.id ?? null
}

async function requireUserId(): Promise<string> {
  const uid = await getCurrentUserId()
  if (!uid) throw new NotSignedInError()
  return uid
}

// ─────────────────────────────────────────────────────────────────────────────
// Decks
// ─────────────────────────────────────────────────────────────────────────────

export async function listDecks(): Promise<DeckWithProgress[]> {
  const uid = await requireUserId()

  const { data: decks, error } = await withTimeout(
    supabase
      .from('flashcard_decks')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false }),
    12000,
    'Deste listesi',
  )

  if (error) throw error
  if (!decks || decks.length === 0) return []

  const deckIds = decks.map((d: { id: string }) => d.id)

  const { data: cards, error: cErr } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .select('deck_id,status')
      .in('deck_id', deckIds),
    12000,
    'Kart özeti',
  )

  if (cErr) throw cErr

  const map = new Map<string, { known: number; unknown: number; unseen: number; total: number }>()
  deckIds.forEach((id: string) => map.set(id, { known: 0, unknown: 0, unseen: 0, total: 0 }))

  for (const c of cards ?? []) {
    const m = map.get(c.deck_id as string)
    if (!m) continue
    m.total += 1
    if (c.status === 'known') m.known += 1
    else if (c.status === 'unknown') m.unknown += 1
    else m.unseen += 1
  }

  return (decks as FlashcardDeck[]).map((d) => {
    const m = map.get(d.id) ?? { known: 0, unknown: 0, unseen: 0, total: 0 }
    const total = m.total
    const percent = total > 0 ? Math.round((m.known / total) * 100) : 0
    return { ...d, progress: { ...m, percent } }
  })
}

export async function getDeck(deckId: string): Promise<FlashcardDeck | null> {
  const uid = await requireUserId()
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_decks')
      .select('*')
      .eq('id', deckId)
      .eq('user_id', uid)
      .maybeSingle(),
    12000,
    'Deste detayı',
  )
  if (error) throw error
  return (data as FlashcardDeck | null) ?? null
}

export async function getDeckWithProgress(deckId: string): Promise<DeckWithProgress | null> {
  const deck = await getDeck(deckId)
  if (!deck) return null
  const { data: cards, error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .select('status')
      .eq('deck_id', deckId),
    12000,
    'Deste ilerlemesi',
  )
  if (error) throw error
  const p = { known: 0, unknown: 0, unseen: 0, total: 0 }
  for (const c of cards ?? []) {
    p.total += 1
    if (c.status === 'known') p.known += 1
    else if (c.status === 'unknown') p.unknown += 1
    else p.unseen += 1
  }
  const percent = p.total > 0 ? Math.round((p.known / p.total) * 100) : 0
  return { ...deck, progress: { ...p, percent } }
}

export async function createDeck(input: {
  title: string
  description?: string | null
  source?: 'manual' | 'vocab'
  vocab_list_id?: string | null
}): Promise<FlashcardDeck> {
  const uid = await requireUserId()
  const payload = {
    user_id: uid,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    source: input.source ?? 'manual',
    vocab_list_id: input.vocab_list_id ?? null,
  }
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_decks')
      .insert(payload)
      .select('*')
      .single(),
    12000,
    'Deste oluşturma',
  )
  if (error) throw error
  return data as FlashcardDeck
}

export async function updateDeck(
  deckId: string,
  patch: { title?: string; description?: string | null },
): Promise<FlashcardDeck> {
  const uid = await requireUserId()
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title !== undefined) body.title = patch.title.trim()
  if (patch.description !== undefined) body.description = patch.description?.trim() || null
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_decks')
      .update(body)
      .eq('id', deckId)
      .eq('user_id', uid)
      .select('*')
      .single(),
    12000,
    'Deste güncelleme',
  )
  if (error) throw error
  return data as FlashcardDeck
}

export async function deleteDeck(deckId: string): Promise<void> {
  const uid = await requireUserId()
  const { error } = await withTimeout(
    supabase
      .from('flashcard_decks')
      .delete()
      .eq('id', deckId)
      .eq('user_id', uid),
    12000,
    'Deste silme',
  )
  if (error) throw error
}

export async function resetDeckProgress(deckId: string): Promise<void> {
  const uid = await requireUserId()
  const { error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .update({ status: 'unseen', last_reviewed_at: null })
      .eq('deck_id', deckId)
      .eq('user_id', uid),
    12000,
    'İlerlemeyi sıfırlama',
  )
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────────────────────────────────────

export async function listCards(deckId: string): Promise<FlashcardCard[]> {
  const uid = await requireUserId()
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .select('*')
      .eq('deck_id', deckId)
      .eq('user_id', uid)
      .order('created_at', { ascending: true }),
    12000,
    'Kart listesi',
  )
  if (error) throw error
  return (data as FlashcardCard[]) ?? []
}

export async function createCard(input: {
  deck_id: string
  front: string
  back: string
}): Promise<FlashcardCard> {
  const uid = await requireUserId()
  const front = input.front.trim()
  const back = input.back.trim()
  if (!front || !back) throw new Error('Hem ön hem arka yüz boş olamaz.')
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .insert({
        deck_id: input.deck_id,
        user_id: uid,
        front,
        back,
        status: 'unseen',
      })
      .select('*')
      .single(),
    12000,
    'Kart oluşturma',
  )
  if (error) throw error
  return data as FlashcardCard
}

export async function updateCard(
  cardId: string,
  patch: { front?: string; back?: string },
): Promise<FlashcardCard> {
  const uid = await requireUserId()
  const body: Record<string, unknown> = {}
  if (patch.front !== undefined) body.front = patch.front.trim()
  if (patch.back !== undefined) body.back = patch.back.trim()
  if (!Object.keys(body).length) {
    const cur = await getCard(cardId)
    if (!cur) throw new Error('Kart bulunamadı')
    return cur
  }
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .update(body)
      .eq('id', cardId)
      .eq('user_id', uid)
      .select('*')
      .single(),
    12000,
    'Kart güncelleme',
  )
  if (error) throw error
  return data as FlashcardCard
}

export async function getCard(cardId: string): Promise<FlashcardCard | null> {
  const uid = await requireUserId()
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .select('*')
      .eq('id', cardId)
      .eq('user_id', uid)
      .maybeSingle(),
    12000,
    'Kart detayı',
  )
  if (error) throw error
  return (data as FlashcardCard | null) ?? null
}

export async function deleteCard(cardId: string): Promise<void> {
  const uid = await requireUserId()
  const { error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', uid),
    12000,
    'Kart silme',
  )
  if (error) throw error
}

export async function updateCardStatus(
  cardId: string,
  status: CardStatus,
): Promise<void> {
  const uid = await requireUserId()
  const { error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .update({ status, last_reviewed_at: new Date().toISOString() })
      .eq('id', cardId)
      .eq('user_id', uid),
    12000,
    'Kart durumu güncelleme',
  )
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Vocab import (build deck from user's saved_words)
// ─────────────────────────────────────────────────────────────────────────────

export type VocabSourceItem = {
  word: string
  translation: string | null
}

export async function listVocabForImport(): Promise<VocabSourceItem[]> {
  // Delegate to the canonical saved-words listing so we automatically support
  // guest-mode (AsyncStorage) users and the actual schema (created_at,
  // not the optional saved_at column).
  const { listSavedWords } = await import('./data')
  const rows = await listSavedWords({ orderBy: 'created_at', ascending: false, limit: 500 })
  return rows
    .map((r) => ({
      word: String(r.word || '').trim(),
      translation: (r.translation ?? null) as string | null,
    }))
    .filter((r) => !!r.word)
}

export async function importFromVocab(input: {
  title: string
  description?: string | null
  items: VocabSourceItem[]
}): Promise<FlashcardDeck> {
  const uid = await requireUserId()
  const items = input.items.filter((it) => it.word && it.translation)
  if (items.length === 0) throw new Error('Çevirisi olan kelime bulunamadı.')

  const deck = await createDeck({
    title: input.title,
    description: input.description,
    source: 'vocab',
  })

  const rows = items.map((it) => ({
    deck_id: deck.id,
    user_id: uid,
    front: it.word.trim(),
    back: (it.translation || '').trim(),
    status: 'unseen' as const,
  }))

  // Chunked insert to stay under PostgREST payload limits
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await withTimeout(
      supabase.from('flashcard_cards').insert(chunk),
      12000,
      'Sözlükten kart içe aktarma',
    )
    if (error) throw error
  }

  // Re-fetch to get updated card_count
  const fresh = await getDeck(deck.id)
  return fresh ?? deck
}

// Add saved words as cards to an EXISTING deck.
// Skips words whose front (case-insensitive) already exists in the deck.
export async function addCardsFromVocab(input: {
  deck_id: string
  items: VocabSourceItem[]
}): Promise<{ added: number; skipped: number }> {
  const uid = await requireUserId()
  const items = input.items.filter((it) => it.word && it.translation)
  if (items.length === 0) return { added: 0, skipped: 0 }

  // Fetch existing fronts to dedupe
  const { data: existing, error: exErr } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .select('front')
      .eq('deck_id', input.deck_id)
      .eq('user_id', uid),
    12000,
    'Mevcut kartları kontrol etme',
  )
  if (exErr) throw exErr

  const existingSet = new Set(
    (existing ?? []).map((r: any) => String(r.front || '').trim().toLowerCase()),
  )

  const fresh = items.filter(
    (it) => !existingSet.has(it.word.trim().toLowerCase()),
  )
  const skipped = items.length - fresh.length
  if (fresh.length === 0) return { added: 0, skipped }

  const rows = fresh.map((it) => ({
    deck_id: input.deck_id,
    user_id: uid,
    front: it.word.trim(),
    back: (it.translation || '').trim(),
    status: 'unseen' as const,
  }))

  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await withTimeout(
      supabase.from('flashcard_cards').insert(chunk),
      12000,
      'Sözlükten kart ekleme',
    )
    if (error) throw error
  }

  return { added: fresh.length, skipped }
}

// ─────────────────────────────────────────────────────────────────────────────
// Match / Game sessions
// ─────────────────────────────────────────────────────────────────────────────

export type MatchSessionInput = {
  deck_id: string
  score: number
  duration_seconds: number
  correct_count: number
  wrong_count: number
  max_streak: number
}

// Picks `count` random cards from a deck (server-side shuffle).
// Useful for Match mode (typically count=6).
export async function listRandomCards(
  deckId: string,
  count: number,
): Promise<FlashcardCard[]> {
  const uid = await requireUserId()
  const { data, error } = await withTimeout(
    supabase
      .from('flashcard_cards')
      .select('*')
      .eq('deck_id', deckId)
      .eq('user_id', uid),
    12000,
    'Rastgele kartları yükleme',
  )
  if (error) throw error
  const all = (data ?? []) as FlashcardCard[]
  // Client-side Fisher–Yates shuffle (Supabase has no random() in PostgREST API).
  const a = all.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, Math.max(0, count))
}

// Records a finished Match game session to Supabase.
// No-throw: if the user is guest / offline / table missing, we just warn.
export async function recordMatchSession(input: MatchSessionInput): Promise<void> {
  try {
    const uid = await getCurrentUserId()
    if (!uid) return // guest mode: nothing to do
    const row = {
      user_id: uid,
      deck_id: input.deck_id,
      mode: 'match' as const,
      score: Math.max(0, Math.round(input.score)),
      duration_seconds: Math.max(0, Math.round(input.duration_seconds)),
      correct_count: Math.max(0, Math.round(input.correct_count)),
      wrong_count: Math.max(0, Math.round(input.wrong_count)),
      max_streak: Math.max(0, Math.round(input.max_streak)),
    }
    const { error } = await withTimeout(
      supabase.from('flashcard_sessions').insert(row),
      8000,
      'Oturum kaydı',
    )
    if (error) {
      // Swallow — don't block the end-of-game UX over analytics persistence.
      console.warn('[flashcards] recordMatchSession:', error.message)
    }
  } catch (e: any) {
    console.warn('[flashcards] recordMatchSession failed:', e?.message ?? e)
  }
}
