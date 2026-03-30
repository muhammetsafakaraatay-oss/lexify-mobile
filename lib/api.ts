const BASE = process.env.EXPO_PUBLIC_API_BASE!

export async function translateWord(word: string, sentence: string) {
  const res = await fetch(`${BASE}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, sentence }),
  })
  return res.json()
}

export async function fetchArticle(url: string) {
  const res = await fetch(`${BASE}/api/fetch-article`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return res.json()
}

export async function getWordOfDay() {
  const res = await fetch(`${BASE}/api/word-of-day`)
  return res.json()
}

export async function getTextScore(text: string) {
  const res = await fetch(`${BASE}/api/text-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return res.json()
}
