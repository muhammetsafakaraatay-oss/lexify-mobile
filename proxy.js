const http = require('http')
const httpProxy = require('http-proxy')
const fetch = require('node-fetch')

const EXPO_HOST = process.env.EXPO_HOST || '127.0.0.1'
const EXPO_PORT = Number(
  process.env.EXPO_PORT ||
  (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN ? 3000 : 8081)
)
const EXPO_ORIGIN = `http://${EXPO_HOST}:${EXPO_PORT}`
const PORT = Number(process.env.GATEWAY_PORT || 5000)
const TARGET = process.env.EXPO_PUBLIC_API_BASE || 'https://lexitr.vercel.app'
const OPENAI_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_KEY ||
  process.env.EXPO_PUBLIC_OPENAI_PROXY_KEY ||
  null

// Optional: Google Gemini for free-tier features (writing_feedback)
const GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GEMINI_API_KEY ||
  null
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

// Optional: Groq fallback (free, very fast)
const GROQ_KEY = process.env.GROQ_API_KEY || null
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

// Features that should prefer the free Gemini Flash route when key is present
const FREE_TIER_FEATURES = new Set([
  'writing_feedback',
  // Add more features here later if you want them on the free route
])

const proxy = httpProxy.createProxyServer({ ws: true })

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function safeParseJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ── OpenAI → Gemini converters ──────────────────────────────────────────────
// Converts OpenAI-style { role, content } messages into Gemini's
// { systemInstruction, contents } shape.
function openAIMessagesToGemini(messages) {
  const systemTexts = []
  const contents = []
  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string') continue
    if (msg.role === 'system') {
      systemTexts.push(msg.content)
      continue
    }
    const role = msg.role === 'assistant' ? 'model' : 'user'
    contents.push({ role, parts: [{ text: msg.content }] })
  }
  const systemInstruction = systemTexts.length
    ? { parts: [{ text: systemTexts.join('\n\n') }] }
    : undefined
  return { systemInstruction, contents }
}

// Calls Google Gemini's generateContent endpoint and shapes the response to
// the same `{ content, usage, raw }` envelope our mobile client expects.
async function callGemini({ messages, model = GEMINI_MODEL, expectJson = true }) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY tanımlı değil')
  const { systemInstruction, contents } = openAIMessagesToGemini(messages)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`
  const body = {
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
    throw new Error(`Gemini upstream failed (${upstream.status}): ${errText}`)
  }
  const payload = await upstream.json()
  const parts = payload?.candidates?.[0]?.content?.parts || []
  const content = parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim()
  if (!content) {
    throw new Error('Gemini response empty')
  }
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

// Calls Groq's OpenAI-compatible chat completions endpoint as a fallback.
async function callGroq({ messages, model = GROQ_MODEL, expectJson = true }) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY tanımlı değil')
  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
      ...(expectJson ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!upstream.ok) {
    const errText = await upstream.text()
    throw new Error(`Groq upstream failed (${upstream.status}): ${errText}`)
  }
  const completion = await upstream.json()
  return {
    content: completion?.choices?.[0]?.message?.content || '',
    usage: completion?.usage || null,
    raw: completion,
  }
}

async function callOpenAI({ messages, model = 'gpt-4o-mini' }) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY tanımlı değil')
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
    }),
  })
  if (!upstream.ok) {
    const errText = await upstream.text()
    throw new Error(`OpenAI upstream failed (${upstream.status}): ${errText}`)
  }
  const completion = await upstream.json()
  return {
    content: completion?.choices?.[0]?.message?.content || '',
    usage: completion?.usage || null,
    raw: completion,
  }
}

function proxyErrorMessage(err) {
  const detail = err?.message || err?.code || 'bağlantı kurulamadı'
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(detail)) {
    return (
      'Proxy error: Expo dev sunucusu çalışmıyor.\n\n' +
      `Bilgisayarda önce: npx expo start (port ${EXPO_PORT})\n` +
      'Telefonda localhost kullanma — terminaldeki LAN IP adresini aç (ör. http://192.168.x.x:5000).\n\n' +
      `Teknik: ${detail}`
    )
  }
  return `Proxy error: ${detail}`
}

proxy.on('error', (err, req, res) => {
  if (res && res.writeHead && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(proxyErrorMessage(err))
  }
})

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end()
    return
  }

  // TTS proxy — Google Translate pronunciation audio
  if (req.url && req.url.startsWith('/tts')) {
    const urlObj = new URL(req.url, 'http://localhost')
    const text = urlObj.searchParams.get('text') || ''
    const lang = urlObj.searchParams.get('lang') || 'en-US'
    const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`
    try {
      const response = await fetch(gttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      })
      if (!response.ok) throw new Error(`TTS upstream ${response.status}`)
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400'
      })
      response.body.pipe(res)
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('TTS error: ' + err.message)
    }
    return
  }

  if (req.url === '/api/voice-transcribe') {
    if (!OPENAI_KEY) {
      json(res, 503, {
        error: 'Voice transcribe endpoint hazir ama OPENAI_API_KEY tanimli degil.',
      })
      return
    }

    try {
      const body = await readBody(req)
      const upstream = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_KEY}`,
          'Content-Type': req.headers['content-type'] || 'multipart/form-data',
        },
        body,
      })
      const text = await upstream.text()
      res.writeHead(upstream.status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(text)
    } catch (err) {
      json(res, 500, { error: err.message || 'Voice transcription failed' })
    }
    return
  }

  if (req.url === '/api/voice-analyze') {
    if (!OPENAI_KEY) {
      json(res, 503, {
        error: 'Voice analyze endpoint hazir ama OPENAI_API_KEY tanimli degil.',
      })
      return
    }

    try {
      const raw = await readBody(req)
      const payload = raw.length ? JSON.parse(raw.toString('utf8')) : {}
      if (!payload?.transcript?.trim()) {
        json(res, 400, { error: 'Transcript gerekli' })
        return
      }
      const transcript = String(payload.transcript || '').trim()
      const targetWords = Array.isArray(payload.targetWords) ? payload.targetWords.slice(0, 8) : []
      const promptText = String(payload.promptText || '')
      const durationSec = Number(payload.durationSec || 0)
      const detectedLanguage = String(payload.detectedLanguage || '')
      const expectedWpm = durationSec > 0 ? Math.round((transcript.split(/\s+/).length / durationSec) * 60) : 0

      const systemPrompt =
        'You are an English speaking coach for Turkish learners. Return ONLY valid JSON with the exact keys requested. Scores must be integers in [0,100]. Be strict but fair and consistent.'
      const userPrompt = [
        'Evaluate this Voice Echo attempt.',
        `Transcript: """${transcript}"""`,
        `Target words: ${JSON.stringify(targetWords)}`,
        `Prompt shown to learner: """${promptText}"""`,
        `Detected language: ${detectedLanguage || 'unknown'}`,
        `Duration seconds: ${Number.isFinite(durationSec) ? durationSec : 0}`,
        `Estimated words per minute: ${expectedWpm}`,
        '',
        'Return JSON with this schema:',
        '{',
        '  "scores": { "word_usage": number, "grammar": number, "fluency": number, "relevance": number, "total": number },',
        '  "word_checklist": [{ "word": string, "used": boolean, "natural": boolean|null, "context": string|null, "confidence": number }],',
        '  "grammar_issues": [{ "original": string, "correction": string, "rule": string }],',
        '  "feedback_tr": string,',
        '  "encouragement_tr": string',
        '}',
        '',
        'Rules:',
        '- feedback_tr and encouragement_tr must be in Turkish.',
        '- grammar_issues rule must be concise Turkish explanation.',
        '- word_checklist must include every target word once, preserving order.',
        '- confidence is 0..1 with 2 decimals.',
      ].join('\n')

      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })

      if (!upstream.ok) {
        const errText = await upstream.text()
        json(res, upstream.status, { error: `Voice analysis upstream failed: ${errText}` })
        return
      }

      const completion = await upstream.json()
      const content = completion?.choices?.[0]?.message?.content
      const analysis = typeof content === 'string' ? safeParseJson(content) : null
      if (!analysis || !analysis.scores || !Array.isArray(analysis.word_checklist)) {
        json(res, 502, { error: 'Voice analysis invalid JSON payload' })
        return
      }

      json(res, 200, analysis)
    } catch (err) {
      json(res, 500, { error: err.message || 'Voice analysis failed' })
    }
    return
  }

  if (req.url === '/api/llm-call') {
    try {
      const raw = await readBody(req)
      const payload = raw.length ? JSON.parse(raw.toString('utf8')) : {}
      const messages = Array.isArray(payload.messages) ? payload.messages : []
      const feature = typeof payload.feature === 'string' ? payload.feature : ''
      const requestedModel = payload.model || 'gpt-4o-mini'
      if (!messages.length) {
        json(res, 400, { error: 'messages gerekli' })
        return
      }

      // ── Provider routing ────────────────────────────────────────────────
      // Free-tier features (e.g. writing_feedback) prefer Gemini → Groq → OpenAI.
      // Everything else stays on OpenAI to preserve existing behavior.
      const preferFree = FREE_TIER_FEATURES.has(feature)
      const wantsJson = preferFree // free-tier features always want strict JSON

      const providerOrder = preferFree
        ? [
            GEMINI_KEY ? 'gemini' : null,
            GROQ_KEY ? 'groq' : null,
            OPENAI_KEY ? 'openai' : null,
          ].filter(Boolean)
        : [OPENAI_KEY ? 'openai' : null].filter(Boolean)

      if (providerOrder.length === 0) {
        json(res, 503, {
          error:
            'LLM endpoint hazir ama hiçbir provider key tanımlı değil ' +
            '(OPENAI_API_KEY, GEMINI_API_KEY veya GROQ_API_KEY).',
        })
        return
      }

      let lastError = null
      for (const provider of providerOrder) {
        try {
          let result
          if (provider === 'gemini') {
            result = await callGemini({ messages, expectJson: wantsJson })
          } else if (provider === 'groq') {
            result = await callGroq({ messages, expectJson: wantsJson })
          } else {
            result = await callOpenAI({ messages, model: requestedModel })
          }
          json(res, 200, {
            content: result.content,
            usage: result.usage,
            raw: result.raw,
            provider, // helpful for debugging which path served the request
          })
          return
        } catch (err) {
          lastError = err
          // Try next provider in chain
        }
      }

      json(res, 502, {
        error: `LLM upstream failed across all providers: ${lastError?.message || 'unknown'}`,
      })
    } catch (err) {
      json(res, 500, { error: err.message || 'LLM request failed' })
    }
    return
  }

  if (req.url === '/api/ai-log') {
    // Faz 0 uyumlulugu icin client log kabul endpoint'i.
    // DB kaydi sonraki adimda API backend tarafina tasinacak.
    json(res, 200, { ok: true })
    return
  }

  if (req.url && req.url.startsWith('/api/')) {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const options = {
          method: req.method,
          headers: { 'Content-Type': 'application/json' },
        }
        if (body && req.method !== 'GET') options.body = body
        const response = await fetch(`${TARGET}${req.url}`, options)
        const data = await response.text()
        res.writeHead(response.status, { 'Content-Type': 'application/json' })
        res.end(data)
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
  } else {
    proxy.web(req, res, { target: EXPO_ORIGIN })
  }
})

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: EXPO_ORIGIN.replace('http', 'ws') })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway running on http://0.0.0.0:${PORT}`)
  console.log(`  /api/* → ${TARGET}`)
  console.log(`  /*     → ${EXPO_ORIGIN} (Expo — önce "npx expo start" çalışsın)`)
  const providers = []
  if (GEMINI_KEY) providers.push(`Gemini(${GEMINI_MODEL})`)
  if (GROQ_KEY) providers.push(`Groq(${GROQ_MODEL})`)
  if (OPENAI_KEY) providers.push('OpenAI(gpt-4o-mini)')
  console.log(`  LLM providers: ${providers.length ? providers.join(' → ') : 'NONE (no API keys set)'}`)
  console.log(`  Free-tier features: ${[...FREE_TIER_FEATURES].join(', ') || '(none)'}`)
  console.log('  Telefonda: terminaldeki LAN URL (localhost değil)')
})
