import { API_BASE_URL } from './config'

export interface TranslationResult {
  tr?: string
  context?: string
  example?: string
  examples?: string[]
  ipa?: string
  cefr?: string
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
    // Some endpoints may legitimately return empty bodies.
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

export function translateWord(word: string, sentence: string): Promise<TranslationResult> {
  return postJson('/api/translate', { word, sentence })
}

export function fetchArticle(url: string): Promise<ArticlePayload> {
  // Articles can be large — give it a bit more headroom.
  return postJson('/api/fetch-article', { url }, 30_000)
}

export function fetchYoutubeTranscript(url: string): Promise<TranscriptPayload> {
  return postJson('/api/youtube-transcript', { url }, 30_000)
}

export function getArticles() {
  return request<{ articles?: any[] }>('/api/articles')
}

export function processOcr(image: string) {
  return postJson<{ text?: string }>('/api/ocr', { image }, 30_000)
}

export function getWordOfDay(): Promise<WordOfDayPayload> {
  return request('/api/word-of-day')
}

export function getTextScore(text: string) {
  return postJson('/api/text-score', { text })
}
