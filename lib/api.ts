import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { API_BASE_URL } from './config'
import type { VoiceScores, VoiceFeedback, VoiceWordTiming } from './voice'

export interface TranslationResult {
  tr?: string
  context?: string
  example?: string
  examples?: string[]
  ipa?: string
  cefr?: string
}

export interface BatchTranslationItem {
  word: string
  tr?: string
  ipa?: string
  cefr?: string
  error?: string
}

export interface ArticlePayload {
  text?: string
}

export interface TranscriptSegment {
  text: string
  offset: number
  duration: number
}

export interface TranscriptPayload {
  text?: string
  videoId?: string
  segments?: TranscriptSegment[]
}

export interface WordOfDayPayload {
  word?: string
  translation?: string
  cefr?: string
}

export interface VoiceTranscriptionPayload {
  text?: string
  language?: string
  words?: VoiceWordTiming[]
}

export interface VoiceAnalysisPayload {
  scores: VoiceScores
  word_checklist: VoiceFeedback['word_checklist']
  grammar_issues: VoiceFeedback['grammar_issues']
  feedback_tr: string
  encouragement_tr: string
}

const WORD_OF_DAY_CACHE_KEY = 'word_of_day_cache_v2'
const WORD_OF_DAY_FALLBACK_POOL: Array<Required<WordOfDayPayload>> = [
  { word: 'insight', translation: 'içgörü', cefr: 'B2' },
  { word: 'resilient', translation: 'dayanıklı', cefr: 'B2' },
  { word: 'glimpse', translation: 'kısa bakış', cefr: 'B1' },
  { word: 'steady', translation: 'istikrarlı', cefr: 'B1' },
  { word: 'curious', translation: 'meraklı', cefr: 'A2' },
  { word: 'thrive', translation: 'gelişmek', cefr: 'B2' },
  { word: 'craft', translation: 'ustalıkla yapmak', cefr: 'B1' },
  { word: 'vivid', translation: 'canlı, belirgin', cefr: 'B2' },
  { word: 'gentle', translation: 'nazik, yumuşak', cefr: 'A2' },
  { word: 'spark', translation: 'kıvılcım, tetiklemek', cefr: 'B1' },
  { word: 'remarkable', translation: 'dikkate değer', cefr: 'B2' },
  { word: 'wander', translation: 'dolaşmak', cefr: 'B1' },
  { word: 'clarify', translation: 'netleştirmek', cefr: 'B1' },
  { word: 'nurture', translation: 'beslemek, geliştirmek', cefr: 'B2' },
  { word: 'bold', translation: 'cesur', cefr: 'A2' },
  { word: 'anchor', translation: 'çapa, sabitlemek', cefr: 'B2' },
  { word: 'balance', translation: 'denge', cefr: 'B1' },
  { word: 'immerse', translation: 'içine dalmak', cefr: 'B2' },
  { word: 'refine', translation: 'iyileştirmek, rafine etmek', cefr: 'B2' },
  { word: 'patience', translation: 'sabır', cefr: 'B1' },
  { word: 'reliable', translation: 'güvenilir', cefr: 'B1' },
  { word: 'eager', translation: 'istekli', cefr: 'A2' },
  { word: 'shift', translation: 'değişim, kaymak', cefr: 'B1' },
  { word: 'focus', translation: 'odak', cefr: 'A2' },
  { word: 'stretch', translation: 'esnemek, uzatmak', cefr: 'B1' },
  { word: 'capture', translation: 'yakalamak', cefr: 'B1' },
  { word: 'reflect', translation: 'yansıtmak, düşünmek', cefr: 'B2' },
  { word: 'notice', translation: 'fark etmek', cefr: 'A2' },
  { word: 'restore', translation: 'geri getirmek', cefr: 'B2' },
  { word: 'supportive', translation: 'destekleyici', cefr: 'B2' },
]
const WORD_OF_DAY_REPEAT_WINDOW_DAYS = 5

const DEFAULT_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new ApiError(`API request failed: ${res.status} ${res.statusText}`, res.status)
    }
    const text = await res.text()
    if (!text) return {} as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new ApiError('API returned non-JSON response')
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(`API request timed out after ${timeoutMs}ms`)
    }
    if (err instanceof ApiError) throw err
    throw new ApiError(err?.message || 'Network request failed')
  } finally {
    clearTimeout(timer)
  }
}

function postJson<T>(path: string, body: unknown, timeoutMs?: number) {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  )
}

function normalizeExternalUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function stripReaderHeaders(raw: string) {
  const text = raw.replace(/\r/g, '').trim()
  const marker = 'Markdown Content:'
  const markerIndex = text.indexOf(marker)
  if (markerIndex >= 0) {
    return text.slice(markerIndex + marker.length).trim()
  }
  return text
}

async function fetchArticleViaReader(url: string): Promise<ArticlePayload> {
  const normalized = normalizeExternalUrl(url)
  const readerUrl = `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//i, '')}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 40_000)

  try {
    const res = await fetch(readerUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.8',
        'X-Respond-With': 'text',
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new ApiError(`Reader fallback failed: ${res.status}`, res.status)
    }
    const raw = await res.text()
    const cleaned = stripReaderHeaders(raw)
    if (!cleaned) {
      throw new ApiError('Reader fallback returned empty text')
    }
    return { text: cleaned }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError('Reader fallback timed out after 40000ms')
    }
    if (err instanceof ApiError) throw err
    throw new ApiError(err?.message || 'Reader fallback failed')
  } finally {
    clearTimeout(timer)
  }
}

async function postMultipart<T>(path: string, formData: FormData, timeoutMs: number = 60_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new ApiError(text || `API request failed: ${res.status}`, res.status)
    }
    return (await res.json()) as T
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(`API request timed out after ${timeoutMs}ms`)
    }
    if (err instanceof ApiError) throw err
    throw new ApiError(err?.message || 'Multipart request failed')
  } finally {
    clearTimeout(timer)
  }
}

function getLocalDayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPreviousDayKey(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00`)
  date.setDate(date.getDate() - 1)
  return getLocalDayKey(date)
}

function shiftDayKey(dayKey: string, deltaDays: number) {
  const date = new Date(`${dayKey}T12:00:00`)
  date.setDate(date.getDate() + deltaDays)
  return getLocalDayKey(date)
}

function hashDayKey(dayKey: string) {
  let hash = 0
  for (let i = 0; i < dayKey.length; i++) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0
  }
  return hash
}

function getRecentWordWindow(cache: Record<string, WordOfDayPayload>, dayKey: string, windowDays = WORD_OF_DAY_REPEAT_WINDOW_DAYS) {
  const recent = new Set<string>()
  for (let offset = 1; offset <= windowDays; offset++) {
    const key = shiftDayKey(dayKey, -offset)
    const word = cache[key]?.word?.trim().toLowerCase()
    if (word) recent.add(word)
  }
  return recent
}

function pickFallbackWordOfDay(
  dayKey: string,
  cache: Record<string, WordOfDayPayload>,
): Required<WordOfDayPayload> {
  const recent = getRecentWordWindow(cache, dayKey)
  const start = hashDayKey(dayKey) % WORD_OF_DAY_FALLBACK_POOL.length

  for (let step = 0; step < WORD_OF_DAY_FALLBACK_POOL.length; step++) {
    const candidate = WORD_OF_DAY_FALLBACK_POOL[(start + step) % WORD_OF_DAY_FALLBACK_POOL.length]
    if (!recent.has(candidate.word.toLowerCase())) {
      return candidate
    }
  }

  return WORD_OF_DAY_FALLBACK_POOL[start]
}

function normalizeWordOfDay(payload: WordOfDayPayload | null | undefined): WordOfDayPayload | null {
  const word = payload?.word?.trim()
  const translation = payload?.translation?.trim()
  if (!word || !translation) return null
  return {
    word,
    translation,
    cefr: payload?.cefr?.trim().toUpperCase(),
  }
}

async function readWordOfDayCache(): Promise<Record<string, WordOfDayPayload>> {
  try {
    const raw = await AsyncStorage.getItem(WORD_OF_DAY_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, WordOfDayPayload> : {}
  } catch (error) {
    console.warn('[api] readWordOfDayCache failed:', error)
    return {}
  }
}

async function writeWordOfDayCache(cache: Record<string, WordOfDayPayload>) {
  try {
    await AsyncStorage.setItem(WORD_OF_DAY_CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn('[api] writeWordOfDayCache failed:', error)
  }
}

/** Paralel çeviri — aynı anda en fazla `concurrency` istek */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

export function translateWord(word: string, sentence: string): Promise<TranslationResult> {
  return postJson('/api/translate', { word, sentence })
}

export interface SentenceTranslationResult {
  tr?: string
  original?: string
}

/** Tam cümle çevirisi — uzun basma ile */
export async function translateSentence(sentence: string): Promise<SentenceTranslationResult> {
  const text = sentence.trim().replace(/\s+/g, ' ')
  if (!text) return {}

  // /api/translate-sentence yok (404). Aynı endpoint kelime+cümle olarak
  // tam metni kabul ediyor: word ve sentence = seçilen cümle → tr tam çeviri.
  try {
    const data = await postJson<TranslationResult>(
      '/api/translate',
      { word: text, sentence: text },
      45_000,
    )
    const tr = data.tr?.trim()
    if (tr) return { tr, original: text }
  } catch (e) {
    console.warn('[api] translateSentence failed:', e)
  }

  return { original: text }
}

/**
 * Seçili kelimeleri toplu çevirir. Önce batch endpoint dener, yoksa paralel tekli çeviri.
 */
export async function translateWordsBatch(
  words: string[],
  sentence: string,
): Promise<BatchTranslationItem[]> {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const w of words) {
    const key = w.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(w)
    }
  }
  if (unique.length === 0) return []

  try {
    const batch = await postJson<{ items?: BatchTranslationItem[] }>(
      '/api/translate-batch',
      { words: unique, sentence },
      45_000,
    )
    if (batch.items?.length) {
      const byWord = new Map(batch.items.map((i) => [i.word.toLowerCase(), i]))
      return unique.map((w) => byWord.get(w.toLowerCase()) ?? { word: w, tr: undefined })
    }
  } catch {
    // batch endpoint yoksa tekli çeviriye düş
  }

  return mapWithConcurrency(unique, 4, async (word) => {
    try {
      const data = await translateWord(word, sentence)
      return { word, tr: data.tr, ipa: data.ipa, cefr: data.cefr }
    } catch {
      return { word, error: 'Çevrilemedi' }
    }
  })
}

export async function fetchArticle(url: string): Promise<ArticlePayload> {
  const normalized = normalizeExternalUrl(url)

  try {
    const primary = await postJson<ArticlePayload>('/api/fetch-article', { url: normalized }, 30_000)
    if (primary?.text?.trim()) return primary
  } catch (error) {
    console.warn('[api] fetchArticle primary failed, trying reader fallback:', error)
  }

  return fetchArticleViaReader(normalized)
}

export function fetchYoutubeTranscript(url: string): Promise<TranscriptPayload> {
  return postJson('/api/youtube-transcript', { url }, 30_000)
}

export function getArticles() {
  return request<{ articles?: any[] }>('/api/articles')
}

export function processOcr(image: string) {
  return postJson<{ text?: string }>('/api/ocr', { image }, 60_000)
}

export async function transcribeVoice(audioUri: string): Promise<VoiceTranscriptionPayload> {
  const formData = new FormData()

  if (Platform.OS === 'web') {
    const response = await fetch(audioUri)
    const blob = await response.blob()
    formData.append('file', blob, 'voice-echo.webm')
  } else {
    formData.append('file', {
      uri: audioUri,
      name: 'voice-echo.m4a',
      type: 'audio/m4a',
    } as any)
  }

  formData.append('model', 'whisper-1')
  formData.append('language', 'en')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'word')

  return postMultipart<VoiceTranscriptionPayload>('/api/voice-transcribe', formData, 70_000)
}

export function analyzeVoiceAttempt(input: {
  transcript: string
  targetWords: string[]
  promptText: string
  durationSec: number
  detectedLanguage?: string
}) {
  return postJson<VoiceAnalysisPayload>('/api/voice-analyze', input, 30_000)
}

export async function getWordOfDay(): Promise<WordOfDayPayload> {
  const dayKey = getLocalDayKey()
  const cache = await readWordOfDayCache()

  if (cache[dayKey]?.word && cache[dayKey]?.translation) {
    return cache[dayKey]
  }

  const fallback = pickFallbackWordOfDay(dayKey, cache)
  const recentWords = getRecentWordWindow(cache, dayKey)

  try {
    const remote = normalizeWordOfDay(
      await request<WordOfDayPayload>(
        `/api/word-of-day?date=${encodeURIComponent(dayKey)}&t=${encodeURIComponent(dayKey)}`,
        {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        },
      ),
    )

    const next =
      remote && !recentWords.has(remote.word?.trim().toLowerCase() || '')
        ? remote
        : fallback

    const nextCache = { ...cache, [dayKey]: next }
    await writeWordOfDayCache(nextCache)
    return next
  } catch (error) {
    console.warn('[api] getWordOfDay remote failed, using fallback:', error)
    const nextCache = { ...cache, [dayKey]: fallback }
    await writeWordOfDayCache(nextCache)
    return fallback
  }
}

export function getTextScore(text: string) {
  return postJson('/api/text-score', { text })
}
