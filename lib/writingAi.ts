// Lexify · Writing AI feedback
//
// Calls Google Gemini 2.0 Flash DIRECTLY from the device — no backend needed.
// Gemini's free tier (15 RPM, 1500 RPD) is enough for personal usage and
// rate-limits gracefully if abused (no billing risk).
//
// API key is read from EXPO_PUBLIC_GEMINI_API_KEY at build time. To use:
//   1. Get a free key: https://aistudio.google.com/apikey
//   2. Add to .env (and EAS env for production builds):
//        EXPO_PUBLIC_GEMINI_API_KEY=AIza...
//   3. Restart Expo dev server.
//
// All AI feedback responses are cached on-device for 30 days keyed by the
// content hash + draft id, so revisiting the screen doesn't re-bill.

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { WritingTask } from './writing'
import { callLLM } from './ai/llmClient'
import { analyzeWriting } from './writingAnalyzer'

const GEMINI_API_KEY =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY ||
  ''
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash'

const CACHE_PREFIX = 'writing_ai_feedback_v1:'
const CACHE_TTL_SEC = 60 * 60 * 24 * 30 // 30 days
const BACKEND_AI_TIMEOUT_MS = 3500
const GEMINI_AI_TIMEOUT_MS = 4500

export type AIScores = {
  task_response: number
  coherence: number
  lexical: number
  grammar: number
}

export type AIError = {
  original: string
  corrected: string
  category: 'grammar' | 'vocabulary' | 'spelling' | 'punctuation' | 'style' | string
  explanation: string
}

export type AIWritingFeedback = {
  overall: number              // 4.0 - 9.0
  scores: AIScores
  strengths: string[]          // Turkish
  improvements: string[]       // Turkish
  errors: AIError[]
  model_paragraph?: string     // optional improved intro
  summary: string              // Turkish 1-2 sentences
  cached?: boolean
  generatedAt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Hashing — small djb2 variant, enough for cache keys
// ─────────────────────────────────────────────────────────────────────────────

function fastHash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

function cacheKey(taskId: string, content: string): string {
  return `${CACHE_PREFIX}${taskId}:${fastHash(content)}`
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function readAICache(taskId: string, content: string): Promise<AIWritingFeedback | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(taskId, content))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) return null
    return { ...(parsed.data as AIWritingFeedback), cached: true }
  } catch {
    return null
  }
}

async function writeAICache(taskId: string, content: string, fb: AIWritingFeedback) {
  try {
    await AsyncStorage.setItem(
      cacheKey(taskId, content),
      JSON.stringify({
        expiresAt: Date.now() + CACHE_TTL_SEC * 1000,
        data: fb,
      }),
    )
  } catch {
    // best-effort
  }
}

export async function clearAICache(taskId: string, content: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(taskId, content))
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt construction
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a strict but fair IELTS examiner with 15 years of experience grading academic and general training writing tasks.

You score using the official IELTS band descriptors for:
- Task Response / Task Achievement (TR)
- Coherence and Cohesion (CC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)

Each is scored 0-9 in 0.5 increments. The overall band is the average rounded to the nearest 0.5.

You ALWAYS return ONLY a valid JSON object — no markdown fences, no commentary, no prose outside JSON.
Schema:
{
  "overall": number,
  "scores": { "task_response": number, "coherence": number, "lexical": number, "grammar": number },
  "strengths": string[],
  "improvements": string[],
  "errors": [
    { "original": string, "corrected": string, "category": string, "explanation": string }
  ],
  "model_paragraph": string,
  "summary": string
}

Constraints:
- "strengths" and "improvements" texts MUST be in TURKISH.
- "explanation" and "summary" MUST be in TURKISH.
- "original" and "corrected" stay in ENGLISH.
- "model_paragraph" is an improved English version of the student's introduction or weakest paragraph (max 80 words).
- 2-3 strengths, 3-5 improvements, 3-7 errors.
- Be specific and pedagogical, not generic.`

function buildUserPrompt(task: WritingTask): string {
  return [
    `Task type: ${task.prompt_type}`,
    `Task prompt:\n"""\n${task.prompt_body}\n"""`,
    `Target words: ${task.target_words}`,
    `Student response (${task.word_count} words):`,
    `"""`,
    task.content,
    `"""`,
    ``,
    `Score this response and return the JSON object as specified.`,
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

function extractJsonObject(raw: string): any {
  const trimmed = raw.trim()
  // Strip markdown fences if the model ignored instructions
  const noFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  // Find the outermost {...}
  const first = noFence.indexOf('{')
  const last = noFence.lastIndexOf('}')
  if (first < 0 || last < 0 || last <= first) {
    throw new Error('AI yanıtı JSON içermiyor.')
  }
  const slice = noFence.slice(first, last + 1)
  return JSON.parse(slice)
}

function clampHalfBand(x: any): number {
  const n = Number(x)
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(9, Math.round(n * 2) / 2))
}

function asString(x: any, max = 800): string {
  if (typeof x !== 'string') return ''
  return x.length > max ? x.slice(0, max) : x
}

function asStringArray(x: any, maxItems = 8, maxLen = 400): string[] {
  if (!Array.isArray(x)) return []
  return x
    .filter((v) => typeof v === 'string')
    .map((v: string) => (v.length > maxLen ? v.slice(0, maxLen) : v))
    .slice(0, maxItems)
}

function parseAIResponse(raw: string): AIWritingFeedback {
  const obj = extractJsonObject(raw)

  const scoresRaw = obj?.scores ?? {}
  const scores: AIScores = {
    task_response: clampHalfBand(scoresRaw.task_response),
    coherence:     clampHalfBand(scoresRaw.coherence),
    lexical:       clampHalfBand(scoresRaw.lexical),
    grammar:       clampHalfBand(scoresRaw.grammar),
  }

  const overall = obj?.overall != null
    ? clampHalfBand(obj.overall)
    : clampHalfBand(
        (scores.task_response + scores.coherence + scores.lexical + scores.grammar) / 4,
      )

  const errors: AIError[] = Array.isArray(obj?.errors)
    ? obj.errors
        .filter((e: any) => e && typeof e === 'object')
        .slice(0, 8)
        .map((e: any) => ({
          original:    asString(e?.original, 240),
          corrected:   asString(e?.corrected, 240),
          category:    asString(e?.category, 40) || 'style',
          explanation: asString(e?.explanation, 320),
        }))
        .filter((e: AIError) => e.original && e.corrected)
    : []

  return {
    overall,
    scores,
    strengths:       asStringArray(obj?.strengths, 4, 240),
    improvements:    asStringArray(obj?.improvements, 6, 320),
    errors,
    model_paragraph: asString(obj?.model_paragraph, 600) || undefined,
    summary:         asString(obj?.summary, 400),
    generatedAt:     Date.now(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export type AnalyzeOptions = {
  isPro?: boolean
  userId?: string
  forceRefresh?: boolean
}

export type WritingAIErrorMeta = {
  title: string
  message: string
  showSetupHint?: boolean
}

function toBand(score: number): number {
  return Math.max(0, Math.min(9, Math.round(score * 2) / 2))
}

function heuristicFeedback(task: WritingTask): AIWritingFeedback {
  const base = analyzeWriting(task.content ?? '', task.target_words || 250)
  const modelParagraph =
    (task.content ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p.length > 40)
      ?.split(/\s+/)
      .slice(0, 80)
      .join(' ') || undefined

  return {
    overall: toBand(base.bandScore),
    scores: {
      task_response: toBand(base.scores.taskResponse.score),
      coherence: toBand(base.scores.coherence.score),
      lexical: toBand(base.scores.lexical.score),
      grammar: toBand(base.scores.grammar.score),
    },
    strengths: base.positives.slice(0, 4),
    improvements: base.improvements.slice(0, 5),
    errors: base.errors.slice(0, 6).map((e) => ({
      original: e.snippet,
      corrected: e.snippet,
      category: e.type || 'style',
      explanation: e.suggestion || e.message,
    })),
    model_paragraph: modelParagraph,
    summary:
      base.bandScore >= 7
        ? 'Genel tablo güçlü görünüyor; birkaç nokta cilalanırsa daha yüksek band potansiyeli var.'
        : base.bandScore >= 6
        ? 'Yazın iyi bir temele sahip, ama daha güçlü bağlaçlar ve daha kontrollü cümle yapılarıyla net biçimde yükselebilir.'
        : 'Ana fikir anlaşılıyor; şimdi yapı, kelime çeşitliliği ve dilbilgisi tarafını biraz daha sıkılaştırmak gerekiyor.',
    generatedAt: Date.now(),
  }
}

export function getWritingAIErrorMeta(error: unknown): WritingAIErrorMeta {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()

  if (lower.includes('api anahtarı yok')) {
    return {
      title: 'AI şu anda hazır değil',
      message: 'Derin analiz bu ortamda henüz etkin değil. Temel geri bildirim yine çalışmaya devam eder.',
      showSetupHint: true,
    }
  }

  if (lower.includes('dakikalık') || lower.includes('günlük') || lower.includes('limit')) {
    return {
      title: 'AI limiti doldu',
      message: 'Derin analiz için geçici kullanım sınırına ulaşıldı. Biraz bekleyip tekrar dene.',
    }
  }

  if (lower.includes('bağlanılamadı') || lower.includes('network')) {
    return {
      title: 'AI servisine ulaşılamadı',
      message: 'İnternet bağlantını kontrol edip tekrar dene.',
    }
  }

  if (lower.includes('key reddedildi') || lower.includes('yapılandırılmamış')) {
    return {
      title: 'AI şu anda kullanılamıyor',
      message: 'Derin analiz servisi geçici olarak yapılandırılamadı. Daha sonra tekrar dene.',
      showSetupHint: true,
    }
  }

  return {
    title: 'AI cevap veremedi',
    message: 'Derin analiz şu anda oluşturulamadı. Biraz sonra tekrar deneyebilirsin.',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Gemini call — no backend required
// ─────────────────────────────────────────────────────────────────────────────

async function callGeminiDirect(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API anahtarı yok.',
    )
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=` +
    encodeURIComponent(GEMINI_API_KEY)

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e: any) {
    throw new Error(
      'Gemini API\'ye bağlanılamadı. İnternet bağlantını kontrol et. (' +
      (e?.message || 'network error') + ')',
    )
  }

  if (!response.ok) {
    let detail = ''
    let errorStatus = ''
    try {
      const errBody = await response.text()
      try {
        const parsed = JSON.parse(errBody)
        detail = parsed?.error?.message || errBody.slice(0, 300)
        errorStatus = parsed?.error?.status || ''
      } catch {
        detail = errBody.slice(0, 300)
      }
    } catch {
      detail = ''
    }

    // Expo terminal'inde tam hatayı görmek için — friendly mapper ekrana
    // sadece kısa mesaj basıyor ama gerçek tanı için detay lazım.
    // eslint-disable-next-line no-console
    console.error('[Gemini API error]', {
      status: response.status,
      errorStatus,
      model: GEMINI_MODEL,
      detail,
      retryAfter: response.headers.get('retry-after'),
    })

    if (response.status === 400) {
      throw new Error(
        'Gemini istek reddetti (400). Prompt çok uzun ya da istek biçimi uygun değil.',
      )
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `Gemini API key reddedildi (${response.status}).`,
      )
    }
    if (response.status === 429) {
      // RESOURCE_EXHAUSTED: kota dolmuş, hangi tip kota olduğunu detay söyler
      const retryAfter = response.headers.get('retry-after')
      const isDaily = /per day|daily|requests.*day/i.test(detail)
      const isPerMinute = /per minute|RPM|requests.*minute/i.test(detail)
      const kind = isDaily
        ? 'Günlük (1500/gün) limit'
        : isPerMinute
        ? 'Dakikalık (15/dakika) limit'
        : 'Gemini limit'
      throw new Error(
        `${kind} aşıldı. ` +
        (retryAfter ? `${retryAfter} sn sonra tekrar dene.` : 'Biraz bekleyip tekrar dene.'),
      )
    }
    if (response.status === 404) {
      throw new Error(
        `Model bulunamadı: ${GEMINI_MODEL}.`,
      )
    }
    throw new Error(
      `Gemini hata (${response.status}${errorStatus ? ' ' + errorStatus : ''}).`,
    )
  }

  let payload: any
  try {
    payload = await response.json()
  } catch {
    throw new Error('Gemini yanıtı JSON olarak okunamadı.')
  }

  const parts = payload?.candidates?.[0]?.content?.parts || []
  const content = parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim()

  if (!content) {
    const finishReason = payload?.candidates?.[0]?.finishReason
    throw new Error(
      finishReason
        ? `Gemini yanıt vermedi (${finishReason}). Yazını biraz daha kısa veya genel tut.`
        : 'Gemini boş yanıt döndü.',
    )
  }

  return content
}

export async function analyzeWritingWithAI(
  task: WritingTask,
  opts: AnalyzeOptions = {},
): Promise<AIWritingFeedback> {
  const content = (task.content ?? '').trim()
  if (content.length < 30) {
    throw new Error('AI analizi için en az 30 kelime gerekli.')
  }

  if (!opts.forceRefresh) {
    const cached = await readAICache(task.id, content)
    if (cached) return cached
  }

  let rawText = ''
  const userPrompt = buildUserPrompt(task)

  try {
    const llm = await withTimeout(
      callLLM({
        feature: 'writing_feedback',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        userId: opts.userId,
        isPro: opts.isPro,
        maxRetries: 1,
      }),
      BACKEND_AI_TIMEOUT_MS,
      'Backend AI zaman aşımına uğradı.',
    )

    rawText = llm.content
  } catch (backendError) {
    // Writing feedback should keep working even if the shared LLM backend
    // is misconfigured; fall back to the local Gemini key when available.
    rawText = await withTimeout(
      callGeminiDirect(SYSTEM_PROMPT, userPrompt),
      GEMINI_AI_TIMEOUT_MS,
      'Gemini AI zaman aşımına uğradı.',
    ).catch((geminiError) => {
      const backendMessage =
        backendError instanceof Error ? backendError.message : String(backendError ?? '')
      const geminiMessage =
        geminiError instanceof Error ? geminiError.message : String(geminiError ?? '')

      if (backendMessage || geminiMessage) {
        // eslint-disable-next-line no-console
        console.warn('[Writing AI fallback] Using heuristic feedback instead of provider response.', {
          backendMessage,
          geminiMessage,
        })
      }

      return ''
    })
  }

  if (!rawText.trim()) {
    const fallback = heuristicFeedback(task)
    await writeAICache(task.id, content, fallback)
    return fallback
  }

  let parsed: AIWritingFeedback
  try {
    parsed = parseAIResponse(rawText)
  } catch (e: any) {
    throw new Error(
      'AI yanıtı beklenen JSON formatında değildi. ' +
      'Bu nadiren olur — "Yeniden analiz et" deneyebilirsin.',
    )
  }

  await writeAICache(task.id, content, parsed)
  return parsed
}
