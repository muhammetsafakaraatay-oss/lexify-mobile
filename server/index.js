const express = require('express')
const { Pool } = require('pg')
const fetch = require('node-fetch')

const app = express()
app.use(express.json({ limit: '10mb' }))

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ── Auth middleware ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const userId = req.headers['x-replit-user-id']
  const userName = req.headers['x-replit-user-name']
  if (!userId) return res.status(401).json({ error: 'Not authenticated' })
  req.userId = userId
  req.userName = userName || 'User'
  req.userProfileImage = req.headers['x-replit-user-profile-image'] || null
  // Upsert user on every authenticated request
  try {
    await pool.query(
      `INSERT INTO users (id, name, avatar_url) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url`,
      [userId, req.userName, req.userProfileImage]
    )
  } catch (e) {
    console.error('Upsert user error:', e.message)
  }
  next()
}

// ── Auth endpoints ───────────────────────────────────────────────────────────
app.get('/api/auth/me', (req, res) => {
  const userId = req.headers['x-replit-user-id']
  const userName = req.headers['x-replit-user-name']
  const profileImage = req.headers['x-replit-user-profile-image']
  if (!userId) return res.json({ user: null })
  res.json({ user: { id: userId, name: userName, avatar_url: profileImage } })
})

// ── Saved words ──────────────────────────────────────────────────────────────
app.get('/api/saved-words', requireAuth, async (req, res) => {
  try {
    const { search, orderBy, ascending, limit } = req.query
    const ALLOWED_ORDER = ['created_at', 'review_count', 'due_at', 'repetitions']
    const order = ALLOWED_ORDER.includes(orderBy) ? orderBy : null
    const asc = ascending === 'true'

    let sql = 'SELECT * FROM saved_words WHERE user_id = $1'
    const params = [req.userId]

    if (search) {
      params.push(`%${search}%`)
      sql += ` AND (word ILIKE $${params.length} OR translation ILIKE $${params.length})`
    }
    if (order) {
      sql += ` ORDER BY ${order} ${asc ? 'ASC' : 'DESC'}`
    }
    if (limit && !isNaN(parseInt(limit))) {
      params.push(parseInt(limit))
      sql += ` LIMIT $${params.length}`
    }

    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (e) {
    console.error('GET /api/saved-words error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/saved-words', requireAuth, async (req, res) => {
  try {
    const { word, translation, context, ipa, cefr, source_title, source_url, source_type } = req.body
    if (!word) return res.status(400).json({ error: 'word required' })
    const { rows } = await pool.query(
      `INSERT INTO saved_words (user_id, word, translation, context, ipa, cefr, source_title, source_url, source_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, word) DO UPDATE SET
         translation = EXCLUDED.translation,
         context = EXCLUDED.context,
         ipa = EXCLUDED.ipa,
         cefr = EXCLUDED.cefr,
         source_title = EXCLUDED.source_title,
         source_url = EXCLUDED.source_url,
         source_type = EXCLUDED.source_type
       RETURNING *`,
      [req.userId, word, translation, context, ipa, cefr, source_title, source_url, source_type]
    )
    res.json(rows[0])
  } catch (e) {
    console.error('POST /api/saved-words error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/saved-words/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM saved_words WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/saved-words/by-word/:word', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM saved_words WHERE user_id = $1 AND word = $2', [req.userId, req.params.word])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.patch('/api/saved-words/:id/grade', requireAuth, async (req, res) => {
  try {
    const { ease, interval_days, repetitions, lapses, due_at, last_reviewed_at, stage } = req.body
    const { rows } = await pool.query(
      `UPDATE saved_words SET
         ease=$1, interval_days=$2, repetitions=$3, lapses=$4,
         due_at=$5, last_reviewed_at=$6, stage=$7,
         mastered=($7='mastered'), review_count=$3
       WHERE id=$8 AND user_id=$9
       RETURNING *`,
      [ease, interval_days, repetitions, lapses, due_at, last_reviewed_at, stage, req.params.id, req.userId]
    )
    if (!rows[0]) return res.status(404).json({ error: 'not found' })
    res.json(rows[0])
  } catch (e) {
    console.error('PATCH grade error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// ── SRS counts ───────────────────────────────────────────────────────────────
app.get('/api/due-count', requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString()
    const [dueRes, newRes, learningRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage!='mastered' AND due_at<=$2`,
        [req.userId, now]
      ),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage='new'`, [req.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage='learning'`, [req.userId]),
    ])
    res.json({
      due: parseInt(dueRes.rows[0].count),
      newWords: parseInt(newRes.rows[0].count),
      learning: parseInt(learningRes.rows[0].count),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/due-words', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const now = new Date().toISOString()
    const { rows } = await pool.query(
      `SELECT * FROM saved_words WHERE user_id=$1 AND stage!='mastered' AND due_at<=$2
       ORDER BY due_at ASC LIMIT $3`,
      [req.userId, now, limit]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/new-words', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 5, 50)
    const { rows } = await pool.query(
      `SELECT * FROM saved_words WHERE user_id=$1 AND stage='new'
       ORDER BY created_at ASC LIMIT $2`,
      [req.userId, limit]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Stats (dashboard) ────────────────────────────────────────────────────────
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const [totRes, masRes, todRes, wkRes, allDates] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1`, [req.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND stage='mastered'`, [req.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [req.userId, today]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [req.userId, weekAgo]),
      pool.query(`SELECT created_at FROM saved_words WHERE user_id=$1`, [req.userId]),
    ])
    const dates = [...new Set(allDates.rows.map(r => r.created_at.toISOString().split('T')[0]))].sort().reverse()
    let streak = 0
    let check = new Date().toISOString().split('T')[0]
    for (const d of dates) {
      if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate() - 1); check = dt.toISOString().split('T')[0] }
      else break
    }
    res.json({
      total: parseInt(totRes.rows[0].count),
      mastered: parseInt(masRes.rows[0].count),
      today: parseInt(todRes.rows[0].count),
      week: parseInt(wkRes.rows[0].count),
      streak,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Reading history ──────────────────────────────────────────────────────────
app.get('/api/reading-history', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const { rows } = await pool.query(
      `SELECT * FROM reading_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [req.userId, limit]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/reading-history', requireAuth, async (req, res) => {
  try {
    const { title, url, word_count } = req.body
    const { rows } = await pool.query(
      `INSERT INTO reading_history (user_id, title, url, word_count) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.userId, title, url, word_count]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/reading-history/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM reading_history WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Collections ──────────────────────────────────────────────────────────────
app.get('/api/collections', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM collections WHERE user_id=$1`, [req.userId])
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/collections', requireAuth, async (req, res) => {
  try {
    const { name, emoji } = req.body
    const { rows } = await pool.query(
      `INSERT INTO collections (user_id, name, emoji) VALUES ($1,$2,$3) RETURNING *`,
      [req.userId, name, emoji]
    )
    res.json(rows[0])
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete('/api/collections/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM collections WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/collections/:id/words', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sw.* FROM collection_words cw
       JOIN saved_words sw ON cw.word_id = sw.id
       WHERE cw.collection_id = $1`,
      [req.params.id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Profile ──────────────────────────────────────────────────────────────────
app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const [allRes, todayRes, weekRes, historyRes] = await Promise.all([
      pool.query(`SELECT * FROM saved_words WHERE user_id=$1`, [req.userId]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [req.userId, today]),
      pool.query(`SELECT COUNT(*) FROM saved_words WHERE user_id=$1 AND created_at>=$2`, [req.userId, weekAgo]),
      pool.query(`SELECT * FROM reading_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT 3`, [req.userId]),
    ])
    const words = allRes.rows
    const dates = [...new Set(words.map(w => w.created_at.toISOString().split('T')[0]))].sort().reverse()
    let streak = 0
    let check = new Date().toISOString().split('T')[0]
    for (const d of dates) {
      if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate() - 1); check = dt.toISOString().split('T')[0] }
      else break
    }
    const dist = {}
    words.forEach(w => { if (w.cefr) dist[w.cefr] = (dist[w.cefr] || 0) + 1 })
    res.json({
      words,
      stats: {
        total: words.length,
        mastered: words.filter(w => w.stage === 'mastered').length,
        today: parseInt(todayRes.rows[0].count),
        week: parseInt(weekRes.rows[0].count),
        streak,
      },
      cefrDist: dist,
      recentHistory: historyRes.rows,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── TTS proxy ────────────────────────────────────────────────────────────────
app.get('/tts', async (req, res) => {
  const text = req.query.text || ''
  const lang = req.query.lang || 'en-US'
  const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`
  try {
    const response = await fetch(gttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://translate.google.com/'
      }
    })
    if (!response.ok) throw new Error(`TTS upstream ${response.status}`)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    response.body.pipe(res)
  } catch (e) {
    res.status(502).send('TTS error: ' + e.message)
  }
})

// ── External API proxy ───────────────────────────────────────────────────────
const EXTERNAL_API = process.env.EXPO_PUBLIC_API_BASE || 'https://lexitr.vercel.app'

async function proxyToExternal(req, res) {
  try {
    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (req.method !== 'GET' && req.body) {
      options.body = JSON.stringify(req.body)
    }
    const response = await fetch(`${EXTERNAL_API}${req.path}`, options)
    const data = await response.text()
    res.status(response.status).set('Content-Type', 'application/json').send(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

// ── Translation cache (in-memory, 24h TTL) ───────────────────────────────────
const _translateCache = new Map()
const _TRANSLATE_TTL = 24 * 60 * 60 * 1000

app.all('/api/translate', async (req, res) => {
  const word = (req.body?.word || '').toLowerCase().trim()
  if (word) {
    const hit = _translateCache.get(word)
    if (hit && Date.now() - hit.ts < _TRANSLATE_TTL) {
      return res.json(hit.data)
    }
  }
  try {
    const response = await fetch(`${EXTERNAL_API}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const text = await response.text()
    let data
    try { data = JSON.parse(text) } catch { data = { tr: text } }
    if (word && response.ok) _translateCache.set(word, { data, ts: Date.now() })
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.all('/api/fetch-article', proxyToExternal)
app.all('/api/youtube-transcript', proxyToExternal)
app.all('/api/articles', proxyToExternal)
app.all('/api/ocr', proxyToExternal)
app.all('/api/word-of-day', proxyToExternal)
app.all('/api/text-score', proxyToExternal)

const PORT = process.env.SERVER_PORT || 3001
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lexify API server running on port ${PORT}`)
})
