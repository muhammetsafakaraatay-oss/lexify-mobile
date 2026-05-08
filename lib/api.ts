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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init)
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

function postJson<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function translateWord(word: string, sentence: string): Promise<TranslationResult> {
  return postJson('/api/translate', { word, sentence })
}

export function fetchArticle(url: string): Promise<ArticlePayload> {
  return postJson('/api/fetch-article', { url })
}

export function fetchYoutubeTranscript(url: string): Promise<TranscriptPayload> {
  return postJson('/api/youtube-transcript', { url })
}

export function getArticles() {
  return request<{ articles?: any[] }>('/api/articles')
}

export function processOcr(image: string) {
  return postJson<{ text?: string }>('/api/ocr', { image })
}

export function getWordOfDay(): Promise<WordOfDayPayload> {
  return request('/api/word-of-day')
}

export function getTextScore(text: string) {
  return postJson('/api/text-score', { text })
}
