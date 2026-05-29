import type { SavedWord } from './data'
import type { TextToken } from './tokenize'

export interface ContextBridgeMatch {
  savedWordId: string
  word: string
  translation?: string
  sourceTitle?: string
  sourceType?: string
  savedAt?: string
  contextSentence?: string
}

const STOPWORDS = new Set([
  'about', 'after', 'again', 'along', 'also', 'among', 'around', 'because', 'before', 'being',
  'between', 'could', 'every', 'first', 'from', 'have', 'into', 'just', 'like', 'many', 'more',
  'most', 'much', 'must', 'only', 'other', 'over', 'same', 'some', 'such', 'than', 'that',
  'their', 'there', 'these', 'they', 'this', 'those', 'through', 'under', 'very', 'were',
  'what', 'when', 'which', 'while', 'with', 'would', 'your', 'them', 'then', 'been',
])

export function normalizeBridgeWord(input: string) {
  return input.toLowerCase().replace(/[^a-z]/g, '')
}

export function makeSimpleLemma(input: string) {
  const word = normalizeBridgeWord(input)
  if (word.length <= 3) return word
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3)
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1)
  return word
}

function shouldIgnore(word: string) {
  return word.length < 3 || STOPWORDS.has(word)
}

function formsForWord(word: string) {
  const normalized = normalizeBridgeWord(word)
  const lemma = makeSimpleLemma(word)
  return Array.from(new Set([normalized, lemma].filter(Boolean)))
}

export function buildContextBridgeMatches(
  tokens: TextToken[],
  savedWords: SavedWord[],
): Record<number, ContextBridgeMatch> {
  const lookup = new Map<string, SavedWord>()
  for (const saved of savedWords) {
    for (const form of formsForWord(saved.word)) {
      if (!shouldIgnore(form) && !lookup.has(form)) {
        lookup.set(form, saved)
      }
    }
  }

  const seenSavedIds = new Set<string>()
  const matches: Record<number, ContextBridgeMatch> = {}

  tokens.forEach((token, index) => {
    if (!token.word) return
    const forms = formsForWord(token.val)
    const matched = forms
      .map((form) => (!shouldIgnore(form) ? lookup.get(form) : null))
      .find(Boolean)

    if (!matched || seenSavedIds.has(matched.id)) return
    seenSavedIds.add(matched.id)
    matches[index] = {
      savedWordId: matched.id,
      word: matched.word,
      translation: matched.translation,
      sourceTitle: matched.source_title,
      sourceType: matched.source_type,
      savedAt: matched.saved_at || matched.created_at,
      contextSentence: matched.context_sentence || matched.context,
    }
  })

  return matches
}
