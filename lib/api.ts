const BASE = process.env.EXPO_PUBLIC_API_BASE!

export async function translateWord(word: string, sentence: string) {
  try {
    const res = await fetch(`${BASE}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, sentence }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch (e) {
    console.warn('[api] translateWord failed:', e)
    return { error: true, tr: null, cefr: null, example: null }
  }
}

export async function fetchArticle(url: string) {
  try {
    const res = await fetch(`${BASE}/api/fetch-article`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch (e) {
    console.warn('[api] fetchArticle failed:', e)
    return { error: true, text: null }
  }
}

export async function getWordOfDay() {
  try {
    const res = await fetch(`${BASE}/api/word-of-day`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch (e) {
    console.warn('[api] getWordOfDay failed:', e)
    return { error: true }
  }
}

export async function getTextScore(text: string) {
  try {
    const res = await fetch(`${BASE}/api/text-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch (e) {
    console.warn('[api] getTextScore failed:', e)
    return { error: true }
  }
}
