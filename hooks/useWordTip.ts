import { useRef, useState } from 'react'
import { TranslationResult, translateWord } from '../lib/api'
import { supabase } from '../lib/supabase'
import { WordTipData } from '../components/WordTipSheet'
import { upsertSavedWord } from '../lib/data'

interface SaveOptions {
  toggleDelete?: boolean
  context?: string
  ipa?: string
  sourceTitle?: string
  sourceUrl?: string
  sourceType?: 'article_url' | 'manual_text' | 'youtube'
}

export function useWordTip() {
  const [tip, setTip] = useState<WordTipData | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const cache = useRef<Record<string, TranslationResult>>({})

  function getCacheEntry(word: string) {
    return cache.current[word.toLowerCase()]
  }

  async function openWordTip(word: string, sentence: string) {
    const key = word.toLowerCase()

    if (cache.current[key]) {
      setTip({ word, ...cache.current[key] })
      return
    }

    setTip({ word, loading: true })
    const data = await translateWord(word, sentence)
    cache.current[key] = data
    setTip({ word, ...data })
  }

  async function saveTip(options?: SaveOptions) {
    if (!tip?.word) return

    const key = tip.word.toLowerCase()
    const { data: { user } } = await supabase.auth.getUser()

    if (user && options?.toggleDelete && saved[key]) {
      await supabase.from('saved_words').delete().eq('user_id', user.id).eq('word', tip.word)
      setSaved((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    await upsertSavedWord({
      word: tip.word,
      translation: tip.tr,
      context: options?.context ?? tip.context,
      cefr: tip.cefr,
      ipa: options?.ipa ?? tip.ipa,
      source_title: options?.sourceTitle,
      source_url: options?.sourceUrl,
      source_type: options?.sourceType,
    })

    setSaved((prev) => ({ ...prev, [key]: true }))
  }

  return {
    tip,
    setTip,
    saved,
    isSaved: !!saved[tip?.word?.toLowerCase() || ''],
    getCacheEntry,
    openWordTip,
    saveTip,
    closeTip: () => setTip(null),
  }
}
