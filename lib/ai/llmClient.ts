import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE_URL } from '../config'

type LLMFeature =
  | 'context_bridge'
  | 'micro_story'
  | 'reading_coach'
  | 'voice_feedback'
  | 'wrapped'
  | 'reverse_quiz'
  | 'topic_classify'
  | 'writing_feedback'

type LLMMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type LLMRequest = {
  feature: LLMFeature
  model?: 'gpt-4o-mini' | 'gpt-4o'
  messages: LLMMessage[]
  cacheKey?: string
  cacheTTL?: number // seconds
  maxRetries?: number
  userId?: string
}

export type LLMResponse = {
  content: string
  raw?: any
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

const CACHE_PREFIX = 'llm_cache_v1:'
const LIMIT_KEY_PREFIX = 'llm_daily_usage_v1:'
const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_RETRIES = 2

function getDayKey() {
  return new Date().toISOString().slice(0, 10)
}

function getUsageKey(userId: string) {
  return `${LIMIT_KEY_PREFIX}${userId}:${getDayKey()}`
}

async function enforceDailyLimit(userId: string, isPro: boolean) {
  const key = getUsageKey(userId)
  const limit = isPro ? 200 : 20
  const raw = await AsyncStorage.getItem(key)
  const used = Number(raw || 0)
  if (used >= limit) {
    throw new Error(
      isPro
        ? 'Günlük AI kullanım limitine ulaştın (200).'
        : 'Günlük AI kullanım limitine ulaştın (20).',
    )
  }
  await AsyncStorage.setItem(key, String(used + 1))
}

async function readCache(cacheKey: string): Promise<LLMResponse | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${cacheKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) return null
    return parsed.data as LLMResponse
  } catch {
    return null
  }
}

async function writeCache(cacheKey: string, data: LLMResponse, ttlSec: number) {
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${cacheKey}`,
      JSON.stringify({
        expiresAt: Date.now() + ttlSec * 1000,
        data,
      }),
    )
  } catch {
    // no-op
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function logAICall(input: {
  userId?: string
  feature: LLMFeature
  model: string
  usage?: LLMResponse['usage']
  latencyMs: number
  success: boolean
  errorMessage?: string
}) {
  try {
    await fetch(`${API_BASE_URL}/api/ai-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: input.userId,
        feature: input.feature,
        model: input.model,
        tokens_in: input.usage?.prompt_tokens ?? 0,
        tokens_out: input.usage?.completion_tokens ?? 0,
        latency_ms: input.latencyMs,
        success: input.success,
        error_message: input.errorMessage,
      }),
    })
  } catch {
    // no-op: logging should not break feature flow
  }
}

export async function callLLM(req: LLMRequest & { isPro?: boolean }): Promise<LLMResponse> {
  if (!req.messages?.length) throw new Error('LLM isteği için messages gerekli.')

  if (req.userId) {
    await enforceDailyLimit(req.userId, Boolean(req.isPro))
  }

  if (req.cacheKey) {
    const cached = await readCache(req.cacheKey)
    if (cached) return cached
  }

  const model = req.model || DEFAULT_MODEL
  const maxRetries = req.maxRetries ?? DEFAULT_RETRIES
  const startedAt = Date.now()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/llm-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: req.feature,
          model,
          messages: req.messages,
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')

      if (!response.ok) {
        const errorText = await response.text()
        // If the upstream returned HTML (Next.js 404, Cloudflare page, etc.),
        // surface a clean message instead of a wall of HTML in the UI.
        if (!isJson && /<!doctype|<html/i.test(errorText)) {
          throw new Error(
            `LLM endpoint bulunamadı (${response.status}). ` +
            'Backend tarafında /api/llm-call route\'u tanımlı değil. ' +
            'Vercel deployment\'ına bu endpoint eklenmeli.',
          )
        }
        throw new Error(errorText || `LLM request failed: ${response.status}`)
      }

      if (!isJson) {
        const body = await response.text()
        if (/<!doctype|<html/i.test(body)) {
          throw new Error(
            'LLM endpoint HTML döndürdü (JSON beklenmişti). ' +
            'Backend route\'u yanlış yapılandırılmış olabilir.',
          )
        }
        throw new Error('LLM response not JSON')
      }

      const payload = await response.json()
      const content = payload?.content
      if (!content || typeof content !== 'string') {
        throw new Error('LLM response content invalid')
      }

      const result: LLMResponse = {
        content,
        raw: payload?.raw,
        usage: payload?.usage,
      }

      if (req.cacheKey && (req.cacheTTL ?? 0) > 0) {
        await writeCache(req.cacheKey, result, req.cacheTTL ?? 0)
      }

      await logAICall({
        userId: req.userId,
        feature: req.feature,
        model,
        usage: result.usage,
        latencyMs: Date.now() - startedAt,
        success: true,
      })
      return result
    } catch (error: any) {
      if (attempt >= maxRetries) {
        await logAICall({
          userId: req.userId,
          feature: req.feature,
          model,
          latencyMs: Date.now() - startedAt,
          success: false,
          errorMessage: error?.message || 'unknown_error',
        })
        throw error
      }
      await sleep(300 * Math.pow(2, attempt))
    }
  }

  throw new Error('LLM request failed unexpectedly')
}
