// ============================================================================
// Vercel API route for /api/llm-call
//
// This file is meant to be COPIED into your `lexitr` (Vercel) repo so that the
// mobile app's writing_feedback feature has a backend to talk to.
//
// ─── HOW TO DEPLOY ──────────────────────────────────────────────────────────
//
// 1. In your `lexitr` repo, create this file (App Router):
//      app/api/llm-call/route.ts
//
//    OR (Pages Router):
//      pages/api/llm-call.ts   (you'll need to wrap with res.status().json())
//
// 2. Add the env vars in Vercel Project Settings → Environment Variables:
//      GEMINI_API_KEY   → get FREE at https://aistudio.google.com/apikey
//      GROQ_API_KEY     → optional fallback, FREE at https://console.groq.com/keys
//      OPENAI_API_KEY   → optional last-resort fallback (paid)
//
// 3. Redeploy. The mobile app will start using Gemini Flash automatically.
//
// ─── PROVIDER PRIORITY ──────────────────────────────────────────────────────
//
//   writing_feedback (and any FREE_TIER_FEATURES) :
//      Gemini 2.0 Flash  → Groq Llama 3.3 70B  → OpenAI gpt-4o-mini
//
//   everything else (legacy features) :
//      OpenAI gpt-4o-mini only (preserves existing behavior)
//
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs' // 'edge' also works; nodejs is safer for fetch
export const maxDuration = 30  // seconds — Gemini Flash is fast, 30s is generous

// ─── Env / config ───────────────────────────────────────────────────────────

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || null
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || null
const GROQ_KEY = process.env.GROQ_API_KEY || null

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

const FREE_TIER_FEATURES = new Set([
  'writing_feedback',
  // Add more features here later if you want them on the free route.
])

// ─── Types ──────────────────────────────────────────────────────────────────

type LLMMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type CallResult = { content: string; usage: any; raw?: any }

// ─── OpenAI → Gemini converter ──────────────────────────────────────────────

function openAIMessagesToGemini(messages: LLMMessage[]) {
  const systemTexts: string[] = []
  const contents: any[] = []
  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string') continue
    if (msg.role === 'system') {
      systemTexts.push(msg.content)
      continue
    }
    const role = msg.role === 'assistant' ? 'model' : 'user'
    contents.push({ role, parts: [{ text: msg.content }] })
  }
  return {
    systemInstruction: systemTexts.length
      ? { parts: [{ text: systemTexts.join('\n\n') }] }
      : undefined,
    contents,
  }
}

// ─── Provider calls ─────────────────────────────────────────────────────────

async function callGemini(messages: LLMMessage[], expectJson: boolean): Promise<CallResult> {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY tanımlı değil')
  const { systemInstruction, contents } = openAIMessagesToGemini(messages)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL,
  )}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`
  const body: any = {
    contents,
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      maxOutputTokens: 2048,
      ...(expectJson ? { responseMimeType: 'application/json' } : {}),
    },
  }
  if (systemInstruction) body.systemInstruction = systemInstruction

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!upstream.ok) {
    const errText = await upstream.text()
    throw new Error(`Gemini upstream failed (${upstream.status}): ${errText.slice(0, 500)}`)
  }
  const payload: any = await upstream.json()
  const parts = payload?.candidates?.[0]?.content?.parts || []
  const content = parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim()
  if (!content) throw new Error('Gemini response empty')
  return {
    content,
    usage: {
      prompt_tokens: payload?.usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: payload?.usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: payload?.usageMetadata?.totalTokenCount ?? 0,
    },
    raw: payload,
  }
}

async function callGroq(messages: LLMMessage[], expectJson: boolean): Promise<CallResult> {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY tanımlı değil')
  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages,
      ...(expectJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!upstream.ok) {
    const errText = await upstream.text()
    throw new Error(`Groq upstream failed (${upstream.status}): ${errText.slice(0, 500)}`)
  }
  const completion: any = await upstream.json()
  return {
    content: completion?.choices?.[0]?.message?.content || '',
    usage: completion?.usage || null,
    raw: completion,
  }
}

async function callOpenAI(messages: LLMMessage[], model: string): Promise<CallResult> {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY tanımlı değil')
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, temperature: 0.2, messages }),
  })
  if (!upstream.ok) {
    const errText = await upstream.text()
    throw new Error(`OpenAI upstream failed (${upstream.status}): ${errText.slice(0, 500)}`)
  }
  const completion: any = await upstream.json()
  return {
    content: completion?.choices?.[0]?.message?.content || '',
    usage: completion?.usage || null,
    raw: completion,
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON gövde' }, { status: 400 })
  }

  const messages: LLMMessage[] = Array.isArray(payload?.messages) ? payload.messages : []
  const feature = typeof payload?.feature === 'string' ? payload.feature : ''
  const requestedModel = payload?.model || 'gpt-4o-mini'

  if (!messages.length) {
    return NextResponse.json({ error: 'messages gerekli' }, { status: 400 })
  }

  const preferFree = FREE_TIER_FEATURES.has(feature)
  const wantsJson = preferFree

  const providerOrder = (
    preferFree
      ? [
          GEMINI_KEY ? 'gemini' : null,
          GROQ_KEY ? 'groq' : null,
          OPENAI_KEY ? 'openai' : null,
        ]
      : [OPENAI_KEY ? 'openai' : null]
  ).filter(Boolean) as string[]

  if (providerOrder.length === 0) {
    return NextResponse.json(
      {
        error:
          'LLM endpoint hazır ama hiçbir provider key tanımlı değil ' +
          '(OPENAI_API_KEY, GEMINI_API_KEY veya GROQ_API_KEY).',
      },
      { status: 503 },
    )
  }

  let lastError: any = null
  for (const provider of providerOrder) {
    try {
      let result: CallResult
      if (provider === 'gemini') result = await callGemini(messages, wantsJson)
      else if (provider === 'groq') result = await callGroq(messages, wantsJson)
      else result = await callOpenAI(messages, requestedModel)

      return NextResponse.json({
        content: result.content,
        usage: result.usage,
        raw: result.raw,
        provider, // debug: which provider served this
      })
    } catch (err: any) {
      lastError = err
      // try next provider in chain
    }
  }

  return NextResponse.json(
    {
      error: `LLM upstream failed across all providers: ${lastError?.message || 'unknown'}`,
    },
    { status: 502 },
  )
}

// Optional: lightweight health check
export async function GET() {
  return NextResponse.json({
    ok: true,
    providers: {
      gemini: Boolean(GEMINI_KEY),
      groq: Boolean(GROQ_KEY),
      openai: Boolean(OPENAI_KEY),
    },
    free_tier_features: [...FREE_TIER_FEATURES],
  })
}
