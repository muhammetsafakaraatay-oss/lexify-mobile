const express = require('express')
const fetch = require('node-fetch')

const app = express()
const PORT = 3001
const TARGET = 'https://lexitr.vercel.app'

app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.all('/api/*path', async (req, res) => {
  const url = `${TARGET}${req.path}`
  try {
    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body)
    }
    const response = await fetch(url, options)
    const data = await response.text()
    res.status(response.status).set('Content-Type', 'application/json').send(data)
  } catch (err) {
    console.error('Proxy error:', err.message)
    res.status(500).json({ error: 'Proxy error', message: err.message })
  }
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy running on port ${PORT} → ${TARGET}`)
})
