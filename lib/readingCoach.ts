import { translateWordsBatch } from './api'
import { callLLM } from './ai/llmClient'
import type { SavedWord } from './data'
import { tokenizeText } from './tokenize'
import { makeSimpleLemma, normalizeBridgeWord } from './contextBridge'

export interface ReadingCoachWord {
  word: string
  translation?: string
  reason: string
  cefr?: string
  ipa?: string
}

function hashText(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function heuristicWords(text: string, savedWords: SavedWord[]) {
  const saved = new Set(
    savedWords.flatMap((word) => [normalizeBridgeWord(word.word), makeSimpleLemma(word.word)]),
  )
  const counts = new Map<string, number>()
  const original = new Map<string, string>()
  for (const token of tokenizeText(text)) {
    if (!token.word) continue
    const normalized = normalizeBridgeWord(token.val)
    const lemma = makeSimpleLemma(token.val)
    if (normalized.length < 4) continue
    if (saved.has(normalized) || saved.has(lemma)) continue
    counts.set(normalized, (counts.get(normalized) || 0) + 1)
    if (!original.has(normalized)) original.set(normalized, token.val)
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([key]) => ({
      word: original.get(key) || key,
      reason: 'Bu metinde tekrar eden ve okumayı kolaylaştıracak bir kelime.',
    }))
}

export async function buildReadingCoach(params: {
  text: string
  title: string
  sourceType: string
  savedWords: SavedWord[]
  userId?: string
  isPro?: boolean
}): Promise<ReadingCoachWord[]> {
  const fallback = heuristicWords(params.text, params.savedWords)
  const excerpt = splitSentences(params.text).slice(0, 6).join(' ')
  let picks = fallback

  try {
    const response = await callLLM({
      feature: 'reading_coach',
      model: 'gpt-4o-mini',
      userId: params.userId,
      isPro: params.isPro,
      cacheKey: `reading-coach:${hashText(`${params.title}::${excerpt}`)}`,
      cacheTTL: 60 * 60 * 24 * 7,
      maxRetries: 1,
      messages: [
        {
          role: 'system',
          content:
            'Sen bir reading coach’sun. Kullanıcının daha önce kaydetmediği 3-5 İngilizce kelime öner. Sadece JSON dön: {"words":[{"word":"...","reason":"..."}]}',
        },
        {
          role: 'user',
          content: [
            `Title: ${params.title}`,
            `Source type: ${params.sourceType}`,
            `Saved words: ${params.savedWords.map((w) => w.word).slice(0, 80).join(', ') || 'none'}`,
            `Excerpt: ${excerpt}`,
          ].join('\n'),
        },
      ],
    })
    const parsed = JSON.parse(response.content)
    if (Array.isArray(parsed?.words) && parsed.words.length) {
      picks = parsed.words
        .map((item: any) => ({
          word: String(item?.word || '').trim(),
          reason: String(item?.reason || '').trim(),
        }))
        .filter((item: ReadingCoachWord) => item.word)
        .slice(0, 5)
    }
  } catch {
    // heuristic fallback
  }

  const translations = await translateWordsBatch(
    picks.map((item) => item.word),
    excerpt,
  )
  const byWord = new Map(translations.map((item) => [item.word.toLowerCase(), item]))

  return picks.map((item) => {
    const tr = byWord.get(item.word.toLowerCase())
    return {
      ...item,
      translation: tr?.tr,
      ipa: tr?.ipa,
      cefr: tr?.cefr,
    }
  })
}
