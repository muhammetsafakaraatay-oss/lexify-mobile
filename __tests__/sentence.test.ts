import { getSentenceSpan } from '../lib/sentence'
import { tokenizeText } from '../lib/tokenize'

describe('getSentenceSpan', () => {
  it('tek cümleyi nokta sınırında çıkarır', () => {
    const tokens = tokenizeText('Hello world. Next sentence here.')
    const anchor = tokens.findIndex((t) => t.val === 'world')
    const span = getSentenceSpan(tokens, anchor)
    expect(span?.text).toBe('Hello world.')
    expect(span?.text).not.toContain('Next')
  })

  it('ortadaki cümleyi seçer', () => {
    const tokens = tokenizeText('First. Second part here. Third.')
    const anchor = tokens.findIndex((t) => t.val === 'part')
    const span = getSentenceSpan(tokens, anchor)
    expect(span?.text).toBe('Second part here.')
  })

  it('noktasız uzun blokta karakter sınırına uyar', () => {
    const long = 'word '.repeat(120).trim()
    const tokens = tokenizeText(long)
    const anchor = tokens.findIndex((t) => t.val === 'word')
    const span = getSentenceSpan(tokens, anchor)
    expect(span).not.toBeNull()
    expect(span!.text.length).toBeLessThanOrEqual(420)
    expect(span!.text).toContain('word')
  })
})
