const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fetch = require('node-fetch')

const config = getDefaultConfig(__dirname)

config.watchFolders = (config.watchFolders || [__dirname]).filter(
  (folder) => !folder.includes('.local'),
)

config.resolver.blockList = [/\.local\/.*/]

const API_TARGET = process.env.EXPO_PUBLIC_API_BASE || 'https://lexitr.vercel.app'

function readRequestBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
    req.on('error', () => resolve(''))
  })
}

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

/** Web dev: /api/* ve /tts → Vercel (ayrı proxy.js gerekmez) */
config.server = config.server || {}
config.server.enhanceMiddleware = (metroMiddleware) => {
  return async (req, res, next) => {
    const pathname = (req.url || '').split('?')[0]

    if (pathname.startsWith('/api/') || pathname.startsWith('/tts')) {
      sendCors(res)

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      try {
        if (pathname.startsWith('/tts')) {
          const urlObj = new URL(req.url, 'http://localhost')
          const text = urlObj.searchParams.get('text') || ''
          const lang = urlObj.searchParams.get('lang') || 'en-US'
          const gttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=gtx`
          const upstream = await fetch(gttsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Lexify/1.0)',
              Referer: 'https://translate.google.com/',
            },
          })
          if (!upstream.ok) throw new Error(`TTS upstream ${upstream.status}`)
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=86400',
          })
          upstream.body.pipe(res)
          return
        }

        const body = await readRequestBody(req)
        const options = {
          method: req.method,
          headers: { 'Content-Type': 'application/json' },
        }
        if (body && req.method !== 'GET') options.body = body

        const upstream = await fetch(`${API_TARGET}${pathname}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`, options)
        const data = await upstream.text()
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
        res.end(data)
      } catch (err) {
        const message = err?.message || String(err) || 'Proxy error'
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: message,
          hint: 'API ulaşılamadı. İnternet bağlantını kontrol et veya EXPO_PUBLIC_API_BASE ayarla.',
        }))
      }
      return
    }

    return metroMiddleware(req, res, next)
  }
}

module.exports = config
