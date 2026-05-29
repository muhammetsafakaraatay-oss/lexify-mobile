#!/usr/bin/env node

const fs = require('fs')

function readInput(path) {
  if (path) return fs.readFileSync(path, 'utf8')
  return fs.readFileSync(0, 'utf8')
}

function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function parseEntries(raw) {
  const lines = raw.split(/\r?\n/)
  const entries = []

  for (const line of lines) {
    if (!line.includes('[voice][qa]')) continue

    const payload = {}

    const sessionMatch = line.match(/sessionId:\s*'([^']+)'/)
    const wordsMatch = line.match(/targetWords:\s*'([^']*)'/)
    const wordCountMatch = line.match(/transcriptWordCount:\s*(\d+)/)
    const detectedMatch = line.match(/targetDetectedCount:\s*(\d+)/)
    const scoreMatch = line.match(/llmTotalScore:\s*(\d+)/)
    const t1Match = line.match(/transcribeLatencyMs:\s*(\d+)/)
    const t2Match = line.match(/analyzeLatencyMs:\s*(\d+)/)
    const totalMatch = line.match(/totalLatencyMs:\s*(\d+)/)

    if (sessionMatch) payload.sessionId = sessionMatch[1]
    if (wordsMatch) payload.targetWords = wordsMatch[1]
    if (wordCountMatch) payload.transcriptWordCount = Number(wordCountMatch[1])
    if (detectedMatch) payload.targetDetectedCount = Number(detectedMatch[1])
    if (scoreMatch) payload.llmTotalScore = Number(scoreMatch[1])
    if (t1Match) payload.transcribeLatencyMs = Number(t1Match[1])
    if (t2Match) payload.analyzeLatencyMs = Number(t2Match[1])
    if (totalMatch) payload.totalLatencyMs = Number(totalMatch[1])

    if (payload.sessionId) entries.push(payload)
  }

  return entries
}

function toCsv(rows) {
  const headers = [
    'sessionId',
    'targetWords',
    'transcriptWordCount',
    'targetDetectedCount',
    'llmTotalScore',
    'transcribeLatencyMs',
    'analyzeLatencyMs',
    'totalLatencyMs',
  ]
  const out = [headers.join(',')]
  for (const row of rows) {
    out.push(headers.map((key) => csvEscape(row[key])).join(','))
  }
  return out.join('\n')
}

function main() {
  const inputPath = process.argv[2]
  const raw = readInput(inputPath)
  const entries = parseEntries(raw)
  const csv = toCsv(entries)
  process.stdout.write(`${csv}\n`)
  process.stderr.write(`Parsed ${entries.length} QA log rows.\n`)
}

main()
