const http = require('http')
const https = require('https')
const { URL } = require('url')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ── Auth middleware ──────────────────────────────────────────────────────────
async function requireAuth(headers, res) {
  const userId = headers['x-replit-user-id']
  const userName = headers['x-replit-user-name'] || 'User'
  const profileImage = headers['x-replit-user-profile-image'] || null
  if (!userId) {
    sendJson(res, 401, { error: 'Not authenticated' })
    return null
  }
  try {
    await pool.query(
      `INSERT INTO users (id, name, avatar_url) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`,
      [userId, userName, profileImage]
    )
  } catch (e) {
    console.error('Upsert user error:', e.message)
  }
  return { userId, userName, profileImage }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({} ) }
    })
    req.on('error', reject)
  })
}

function parseQuery(url) {
  const u = new URL(url, 'http://localhost')
  const q = {}
  u.searchParams.forEach((v, k) => { q[k] = v })
  return q
}

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const lib = parsed.protocol === 'https:' ? https : http
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    }
    const req = lib.request(reqOptions, r => {
      let body = ''
      r.on('data', c => { body += c })
      r.on('end', () => resolve({ status: r.statusCode, body }))
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

// ── Router ───────────────────────────────────────────────────────────────────
const routes = []
function route(method, pattern, handler) {
  routes.push({ method, pattern, handler })
}

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method && r.method !== 'ALL') continue
    const keys = []
    const regexStr = r.pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return '([^/]+)' })
    const match = pathname.match(new RegExp(`^${regexStr}$`))
    if (match) {
      const params = {}
      keys.forEach((k, i) => { params[k] = decodeURIComponent(match[i + 1]) })
      return { handler: r.handler, params }
    }
  }
  return null
}

// ── Auth endpoints ───────────────────────────────────────────────────────────
route('GET', '/api/auth/me', async (req, res, { headers }) => {
  const userId = headers['x-replit-user-id']
  const userName = headers['x-replit-user-name']
  const profileImage = headers['x-replit-user-profile-image']
  if (!userId) return sendJson(res, 200, { user: null })
  sendJson(res, 200, { user: { id: userId, name: userName, avatar_url: profileImage } })
})

// ── Saved words ──────────────────────────────────────────────────────────────
route('GET', '/api/saved-words', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const { search, orderBy, ascending, limit } = ctx.query
    const ALLOWED_ORDER = ['created_at', 'review_count', 'due_at', 'repetitions']
    const order = ALLOWED_ORDER.includes(orderBy) ? orderBy : null
    const asc = ascending === 'true'
    let sql = 'SELECT * FROM saved_words WHERE user_id = $1'
    const params = [auth.userId]
    if (search) { params.push(`%${search}%`); sql += ` AND (word ILIKE $${params.length} OR translation ILIKE $${params.length})` }
    if (order) { sql += ` ORDER BY ${order} ${asc ? 'ASC' : 'DESC'}` }
    if (limit && !isNaN(parseInt(limit))) { params.push(parseInt(limit)); sql += ` LIMIT $${params.length}` }
    const { rows } = await pool.query(sql, params)
    sendJson(res, 200, rows)
  } catch (e) {
    console.error('GET /api/saved-words error:', e.message)
    sendJson(res, 500, { error: e.message })
  }
})

route('POST', '/api/saved-words', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const { word, translation, context, ipa, cefr, source_title, source_url, source_type } = ctx.body
    if (!word) return sendJson(res, 400, { error: 'word required' })
    const { rows } = await pool.query(
      `INSERT INTO saved_words (user_id, word, translation, context, ipa, cefr, source_title, source_url, source_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, word) DO UPDATE SET
         translation = EXCLUDED.translation, context = EXCLUDED.context,
         ipa = EXCLUDED.ipa, cefr = EXCLUDED.cefr,
         source_title = EXCLUDED.source_title, source_url = EXCLUDED.source_url,
         source_type = EXCLUDED.source_type
       RETURNING *`,
      [auth.userId, word, translation, context, ipa, cefr, source_title, source_url, source_type]
    )
    sendJson(res, 200, rows[0])
  } catch (e) {
    console.error('POST /api/saved-words error:', e.message)
    sendJson(res, 500, { error: e.message })
  }
})

route('DELETE', '/api/saved-words/by-word/:word', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    await pool.query('DELETE FROM saved_words WHERE user_id = $1 AND word = $2', [auth.userId, ctx.params.word])
    sendJson(res, 200, { ok: true })
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('DELETE', '/api/saved-words/:id', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    await pool.query('DELETE FROM saved_words WHERE id = $1 AND user_id = $2', [ctx.params.id, auth.userId])
    sendJson(res, 200, { ok: true })
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('PATCH', '/api/saved-words/:id/grade', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const { ease, interval_days, repetitions, lapses, due_at, last_reviewed_at, stage } = ctx.body
    const { rows } = await pool.query(
      `UPDATE saved_words SET
         ease=$1, interval_days=$2, repetitions=$3, lapses=$4,
         due_at=$5, last_reviewed_at=$6, stage=$7,
         mastered=($7='mastered'), review_count=$3
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [ease, interval_days, repetitions, lapses, due_at, last_reviewed_at, stage, ctx.params.id, auth.userId]
    )
    if (!rows[0]) return sendJson(res, 404, { error: 'not found' })
    sendJson(res, 200, rows[0])
  } catch (e) {
    console.error('PATCH grade error:', e.message)
    sendJson(res, 500, { error: e.message })
  }
})

// ── SRS counts ───────────────────────────────────────────────────────────────
route('GET', '/api/due-count', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const now = new Date().toISOString()
    const [dueRes, newRes, learningRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage!='mastered' AND due_at<=$2`, [auth.userId, now]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage='new'`, [auth.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage='learning'`, [auth.userId]),
    ])
    sendJson(res, 200, {
      due: parseInt(dueRes.rows[0].count),
      newWords: parseInt(newRes.rows[0].count),
      learning: parseInt(learningRes.rows[0].count),
    })
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('GET', '/api/due-words', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const limit = Math.min(parseInt(ctx.query.limit) || 20, 100)
    const now = new Date().toISOString()
    const { rows } = await pool.query(
      `SELECT * FROM saved_words WHERE user_id=$1 AND stage!='mastered' AND due_at<=$2 ORDER BY due_at ASC LIMIT $3`,
      [auth.userId, now, limit]
    )
    sendJson(res, 200, rows)
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('GET', '/api/new-words', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const limit = Math.min(parseInt(ctx.query.limit) || 5, 50)
    const { rows } = await pool.query(
      `SELECT * FROM saved_words WHERE user_id=$1 AND stage='new' ORDER BY created_at ASC LIMIT $2`,
      [auth.userId, limit]
    )
    sendJson(res, 200, rows)
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

// ── Stats ────────────────────────────────────────────────────────────────────
route('GET', '/api/stats', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const [totRes, masRes, todRes, wkRes, allDates] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1`, [auth.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage='mastered'`, [auth.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [auth.userId, today]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [auth.userId, weekAgo]),
      pool.query(`SELECT created_at FROM saved_words WHERE user_id=$1`, [auth.userId]),
    ])
    const dates = [...new Set(allDates.rows.map(r => r.created_at.toISOString().split('T')[0]))].sort().reverse()
    let streak = 0, check = today
    for (const d of dates) {
      if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate() - 1); check = dt.toISOString().split('T')[0] }
      else break
    }
    sendJson(res, 200, {
      total: parseInt(totRes.rows[0].count),
      mastered: parseInt(masRes.rows[0].count),
      today: parseInt(todRes.rows[0].count),
      week: parseInt(wkRes.rows[0].count),
      streak,
    })
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

// ── Reading history ──────────────────────────────────────────────────────────
route('GET', '/api/reading-history', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const limit = Math.min(parseInt(ctx.query.limit) || 50, 200)
    const { rows } = await pool.query(
      `SELECT * FROM reading_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [auth.userId, limit]
    )
    sendJson(res, 200, rows)
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('POST', '/api/reading-history', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const { title, url, word_count } = ctx.body
    const { rows } = await pool.query(
      `INSERT INTO reading_history (user_id, title, url, word_count) VALUES ($1,$2,$3,$4) RETURNING *`,
      [auth.userId, title, url, word_count]
    )
    sendJson(res, 200, rows[0])
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('DELETE', '/api/reading-history/:id', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    await pool.query('DELETE FROM reading_history WHERE id=$1 AND user_id=$2', [ctx.params.id, auth.userId])
    sendJson(res, 200, { ok: true })
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

// ── Collections ──────────────────────────────────────────────────────────────
route('GET', '/api/collections', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const { rows } = await pool.query(`SELECT * FROM collections WHERE user_id=$1`, [auth.userId])
    sendJson(res, 200, rows)
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('POST', '/api/collections', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const { name, emoji } = ctx.body
    const { rows } = await pool.query(
      `INSERT INTO collections (user_id, name, emoji) VALUES ($1,$2,$3) RETURNING *`,
      [auth.userId, name, emoji]
    )
    sendJson(res, 200, rows[0])
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('DELETE', '/api/collections/:id', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    await pool.query('DELETE FROM collections WHERE id=$1 AND user_id=$2', [ctx.params.id, auth.userId])
    sendJson(res, 200, { ok: true })
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('GET', '/api/collections/:id/words', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const { rows } = await pool.query(
      `SELECT sw.* FROM collection_words cw JOIN saved_words sw ON cw.word_id = sw.id WHERE cw.collection_id = $1`,
      [ctx.params.id]
    )
    sendJson(res, 200, rows)
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

// ── Profile ──────────────────────────────────────────────────────────────────
route('GET', '/api/profile', async (req, res, ctx) => {
  const auth = await requireAuth(ctx.headers, res)
  if (!auth) return
  try {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [allRes, todayRes, weekRes, historyRes] = await Promise.all([
      pool.query(`SELECT * FROM saved_words WHERE user_id=$1`, [auth.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [auth.userId, today]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [auth.userId, weekAgo]),
      pool.query(`SELECT * FROM reading_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 3`, [auth.userId]),
    ])
    const words = allRes.rows
    const dates = [...new Set(words.map(w => w.created_at.toISOString().split('T')[0]))].sort().reverse()
    let streak = 0, check = today
    for (const d of dates) {
      if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate() - 1); check = dt.toISOString().split('T')[0] }
      else break
    }
    const dist = {}
    words.forEach(w => { if (w.cefr) dist[w.cefr] = (dist[w.cefr] || 0) + 1 })
    sendJson(res, 200, {
      words,
      stats: { total: words.length, mastered: words.filter(w => w.stage === 'mastered').length, today: parseInt(todayRes.rows[0].count), week: parseInt(weekRes.rows[0].count), streak },
      cefrDist: dist,
      recentHistory: historyRes.rows,
    })
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

// ── TTS proxy ────────────────────────────────────────────────────────────────
route('GET', '/tts', async (req, res, ctx) => {
  const text = ctx.query.text || ''
  const lang = ctx.query.lang || 'en-US'
  const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`
  try {
    const parsed = new URL(gttsUrl)
    const reqOptions = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://translate.google.com/' },
    }
    const upstream = https.request(reqOptions, upstream => {
      if (upstream.statusCode !== 200) {
        res.writeHead(502)
        return res.end('TTS upstream ' + upstream.statusCode)
      }
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      })
      upstream.pipe(res)
    })
    upstream.on('error', e => { res.writeHead(502); res.end('TTS error: ' + e.message) })
    upstream.end()
  } catch (e) {
    res.writeHead(502)
    res.end('TTS error: ' + e.message)
  }
})

// ── External API proxy ───────────────────────────────────────────────────────
const EXTERNAL_API = process.env.EXPO_PUBLIC_API_BASE || 'https://lexitr.vercel.app'
const _translateCache = new Map()
const _TRANSLATE_TTL = 24 * 60 * 60 * 1000

async function proxyToExternal(req, res, ctx) {
  try {
    const url = `${EXTERNAL_API}${ctx.pathname}`
    const options = { method: ctx.method, headers: { 'Content-Type': 'application/json' } }
    if (ctx.method !== 'GET' && ctx.body) options.body = JSON.stringify(ctx.body)
    const { status, body } = await fetchJson(url, options)
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
    res.end(body)
  } catch (e) { sendJson(res, 500, { error: e.message }) }
}

route('ALL', '/api/translate', async (req, res, ctx) => {
  const word = (ctx.body?.word || '').toLowerCase().trim()
  if (word) {
    const hit = _translateCache.get(word)
    if (hit && Date.now() - hit.ts < _TRANSLATE_TTL) return sendJson(res, 200, hit.data)
  }
  try {
    const { status, body } = await fetchJson(`${EXTERNAL_API}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx.body),
    })
    let data
    try { data = JSON.parse(body) } catch { data = { tr: body } }
    if (word && status < 400) _translateCache.set(word, { data, ts: Date.now() })
    sendJson(res, status, data)
  } catch (e) { sendJson(res, 500, { error: e.message }) }
})

route('ALL', '/api/fetch-article', proxyToExternal)
route('ALL', '/api/youtube-transcript', proxyToExternal)
route('ALL', '/api/articles', proxyToExternal)
route('ALL', '/api/ocr', proxyToExternal)
route('ALL', '/api/word-of-day', proxyToExternal)
route('ALL', '/api/text-score', proxyToExternal)

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost')
  const pathname = u.pathname
  const query = {}
  u.searchParams.forEach((v, k) => { query[k] = v })

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  const match = matchRoute(req.method, pathname) || matchRoute('ALL', pathname)
  if (!match) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  let body = {}
  try { body = await readBody(req) } catch {}

  try {
    await match.handler(req, res, {
      headers: req.headers,
      query,
      params: match.params,
      body,
      method: req.method,
      pathname,
    })
  } catch (e) {
    console.error('Handler error:', e)
    sendJson(res, 500, { error: e.message })
  }
})

const PORT = process.env.SERVER_PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Lexify API server running on port ${PORT}`)
})
