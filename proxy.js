const http = require('http')
const httpProxy = require('http-proxy')
const fetch = require('node-fetch')

const EXPO_PORT = 3000
const PORT = 5000
const TARGET = 'https://lexitr.vercel.app'

const proxy = httpProxy.createProxyServer({ ws: true })

proxy.on('error', (err, req, res) => {
  if (res && res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Proxy error: ' + err.message)
  }
})

const server = http.createServer(async (req, res) => {
  if (req.url && req.url.startsWith('/api/')) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

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
    proxy.web(req, res, { target: `http://localhost:${EXPO_PORT}` })
  }
})

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: `ws://localhost:${EXPO_PORT}` })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway running on port ${PORT}`)
  console.log(`  /api/* → ${TARGET}`)
  console.log(`  /*     → http://localhost:${EXPO_PORT} (Expo)`)
})
