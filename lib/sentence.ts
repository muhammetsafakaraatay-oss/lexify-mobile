import { TextToken } from './tokenize'

export interface SentenceSpan {
  start: number
  end: number
  text: string
}

const SENTENCE_END_RE = /[.!?…]["')\]]*\s*$/
/** API zaman aşımını önlemek için üst sınır */
const MAX_SENTENCE_CHARS = 420

function tokenEndsSentence(val: string): boolean {
  return SENTENCE_END_RE.test(val)
}

function resolveWordIndex(tokens: TextToken[], index: number): number {
  if (tokens[index]?.word) return index
  for (let i = index; i >= 0; i--) {
    if (tokens[i]?.word) return i
  }
  for (let i = index; i < tokens.length; i++) {
    if (tokens[i]?.word) return i
  }
  return index
}

/**
 * Dokunulan kelimenin içinde olduğu cümleyi token dizisinden çıkarır.
 */
export function getSentenceSpan(tokens: TextToken[], anchorIndex: number): SentenceSpan | null {
  if (tokens.length === 0) return null

  const anchor = resolveWordIndex(tokens, anchorIndex)
  if (!tokens[anchor]?.word) return null

  const halfBudget = Math.floor(MAX_SENTENCE_CHARS / 2)

  let start = anchor
  let charsBefore = 0
  while (start > 0) {
    const prev = tokens[start - 1]
    if (!prev.word && tokenEndsSentence(prev.val)) break
    if (charsBefore + prev.val.length > halfBudget) break
    charsBefore += prev.val.length
    start--
  }

  let end = anchor
  let charsAfter = tokens[anchor]?.val.length ?? 0
  while (end < tokens.length - 1) {
    const next = tokens[end + 1]
    if (!next.word && tokenEndsSentence(next.val)) {
      end++
      break
    }
    if (charsAfter + next.val.length > halfBudget) break
    charsAfter += next.val.length
    end++
  }

  let text = tokens
    .slice(start, end + 1)
    .map((t) => t.val)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null

  if (text.length > MAX_SENTENCE_CHARS) {
    const anchorOffset = tokens
      .slice(start, anchor + 1)
      .map((t) => t.val)
      .join('').length
    const half = Math.floor(MAX_SENTENCE_CHARS / 2)
    let sliceStart = Math.max(0, anchorOffset - half)
    let sliceEnd = Math.min(text.length, sliceStart + MAX_SENTENCE_CHARS)
    sliceStart = Math.max(0, sliceEnd - MAX_SENTENCE_CHARS)
    text = text.slice(sliceStart, sliceEnd).trim()
    const lead = text.match(/^[^a-zA-Z]*/)
    if (lead?.[0]) text = text.slice(lead[0].length).trim()
  }

  if (!text) return null
  return { start, end, text }
}

export function joinTokens(tokens: TextToken[], start: number, end: number): string {
  return tokens
    .slice(start, end + 1)
    .map((t) => t.val)
    .join('')
    .trim()
}
