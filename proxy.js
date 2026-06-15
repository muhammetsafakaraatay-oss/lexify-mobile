const http = require('http')
const net = require('net')

const EXPO_PORT = 8080
const API_PORT = 3001
const PORT = 5000

function proxyRequest(req, res, targetPort) {
  const options = {
    hostname: 'localhost',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }
  const proxy = http.request(options, upstream => {
    res.writeHead(upstream.statusCode, upstream.headers)
    upstream.pipe(res)
  })
  proxy.on('error', err => {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Proxy error: ' + err.message)
  })
  req.pipe(proxy)
}

const server = http.createServer((req, res) => {
  const url = req.url || ''
  if (url.startsWith('/api/') || url.startsWith('/tts')) {
    proxyRequest(req, res, API_PORT)
  } else {
    proxyRequest(req, res, EXPO_PORT)
  }
})

server.on('upgrade', (req, socket, head) => {
  const targetSocket = net.connect(EXPO_PORT, 'localhost', () => {
    targetSocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    )
    targetSocket.write(head)
    socket.pipe(targetSocket)
    targetSocket.pipe(socket)
  })
  targetSocket.on('error', () => socket.destroy())
  socket.on('error', () => targetSocket.destroy())
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gateway running on port ${PORT}`)
  console.log(`  /api/* → http://localhost:${API_PORT} (Lexify API)`)
  console.log(`  /*     → http://localhost:${EXPO_PORT} (Expo)`)
})
