import { useCallback, useState } from 'react'
import { translateSentence } from '../lib/api'
import { getSentenceSpan, type SentenceSpan } from '../lib/sentence'
import { TextToken } from '../lib/tokenize'

export interface SentenceTranslateState {
  span: SentenceSpan | null
  loading: boolean
  tr: string | null
  error: string | null
  visible: boolean
}

export function useSentenceTranslate(tokens: TextToken[]) {
  const [state, setState] = useState<SentenceTranslateState>({
    span: null,
    loading: false,
    tr: null,
    error: null,
    visible: false,
  })

  const close = useCallback(() => {
    setState({
      span: null,
      loading: false,
      tr: null,
      error: null,
      visible: false,
    })
  }, [])

  const translateAt = useCallback(
    async (wordIndex: number) => {
      const span = getSentenceSpan(tokens, wordIndex)
      if (!span) return

      setState({
        span,
        loading: true,
        tr: null,
        error: null,
        visible: true,
      })

      try {
        const result = await translateSentence(span.text)
        if (result.tr) {
          setState({
            span,
            loading: false,
            tr: result.tr,
            error: null,
            visible: true,
          })
        } else {
          setState({
            span,
            loading: false,
            tr: null,
            error: 'Cümle çevirisi alınamadı. Bağlantını kontrol edip tekrar dene.',
            visible: true,
          })
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Çeviri başarısız'
        setState({
          span,
          loading: false,
          tr: null,
          error: `Cümle çevrilemedi. ${msg}`,
          visible: true,
        })
      }
    },
    [tokens],
  )

  const isInHighlightedSentence = useCallback(
    (index: number) => {
      if (!state.span || !state.visible) return false
      return index >= state.span.start && index <= state.span.end
    },
    [state.span, state.visible],
  )

  return {
    ...state,
    translateAt,
    close,
    isInHighlightedSentence,
  }
}
