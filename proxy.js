const http = require('http')
const httpProxy = require('http-proxy')
const fetch = require('node-fetch')

const EXPO_PORT = 8080
const API_PORT = 3001
const PORT = 5000

const proxy = httpProxy.createProxyServer({ ws: true })

proxy.on('error', (err, req, res) => {
  if (res && res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Proxy error: ' + err.message)
  }
})

const server = http.createServer(async (req, res) => {
  if (
    (req.url && req.url.startsWith('/api/')) ||
    (req.url && req.url.startsWith('/tts'))
  ) {
    proxy.web(req, res, { target: `http://localhost:${API_PORT}` })
  } else {
    proxy.web(req, res, { target: `http://localhost:${EXPO_PORT}` })
  }
})

server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head, { target: `ws://localhost:${EXPO_PORT}` })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway running on port ${PORT}`)
  console.log(`  /api/* → http://localhost:${API_PORT} (Lexify API)`)
  console.log(`  /*     → http://localhost:${EXPO_PORT} (Expo)`)
})
