import { useCallback, useRef, useState } from 'react'
import { Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { TranslationResult, translateWord } from '../lib/api'
import { API_BASE_URL } from '../lib/config'
import { WordTipData } from '../components/WordTipSheet'
import { deleteSavedWord, listSavedWords, upsertSavedWord } from '../lib/data'
import { markJourneyStep } from '../lib/journey'
import { canSaveWord, FREE_LIMITS } from '../lib/plan'
import { getTodaySaveCount, incrementTodaySaveCount } from '../lib/usage'
import { usePremium } from '../contexts/SubscriptionContext'

interface SaveOptions {
  toggleDelete?: boolean
  context?: string
  ipa?: string
  sourceTitle?: string
  sourceUrl?: string
  sourceType?: 'article_url' | 'manual_text' | 'youtube'
}

export function useWordTip() {
  const router = useRouter()
  const { isPro } = usePremium()
  const [tip, setTip] = useState<WordTipData | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const cache = useRef<Record<string, TranslationResult>>({})
  const savedLoaded = useRef(false)
  const lastLookup = useRef<{ word: string; sentence: string } | null>(null)

  function getCacheEntry(word: string) {
    return cache.current[word.toLowerCase()]
  }

  const hydrateSavedWords = useCallback(async () => {
    if (savedLoaded.current) return
    savedLoaded.current = true
    try {
      const words = await listSavedWords()
      setSaved((prev) => {
        const next = { ...prev }
        for (const w of words) {
          if (w.word) next[w.word.toLowerCase()] = true
        }
        return next
      })
    } catch (e) {
      console.warn('[word-tip] hydrate saved words failed:', e)
      savedLoaded.current = false
    }
  }, [])

  async function openWordTip(word: string, sentence: string) {
    const key = word.toLowerCase()
    const normalizedSentence = sentence.trim().slice(0, 500)
    lastLookup.current = { word, sentence: normalizedSentence }

    void hydrateSavedWords()

    if (cache.current[key]) {
      setTip({ word, ...cache.current[key] })
      return
    }

    setTip({ word, loading: true })
    try {
      const data = await translateWord(word, normalizedSentence)
      cache.current[key] = data
      setTip({ word, ...data })
    } catch (error: any) {
      console.warn('[word-tip] translateWord failed:', error, 'base:', API_BASE_URL || '(same-origin)')
      const detail = error?.message ? ` (${String(error.message).slice(0, 80)})` : ''
      setTip({
        word,
        tr: 'Anlam şu an alınamadı',
        context: normalizedSentence || sentence || word,
        error: `Çeviri alınamadı. İnternet bağlantını kontrol edip tekrar dene.${detail}`,
      })
    }
  }

  async function saveTip(options?: SaveOptions) {
    if (!tip?.word) return

    const key = tip.word.toLowerCase()

    if (options?.toggleDelete && saved[key]) {
      const words = await listSavedWords()
      const existing = words.find((w) => w.word.toLowerCase() === key)
      if (existing) await deleteSavedWord(existing.id)
      setSaved((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    if (!saved[key]) {
      const [words, todaySaves] = await Promise.all([
        listSavedWords(),
        getTodaySaveCount(),
      ])
      if (!canSaveWord(isPro, words.length, todaySaves)) {
        const reason = words.length >= FREE_LIMITS.maxSavedWords
          ? `Ücretsiz planda en fazla ${FREE_LIMITS.maxSavedWords} kelime kaydedebilirsin.`
          : `Bugünkü kayıt limitine (${FREE_LIMITS.maxSavesPerDay}) ulaştın.`
        Alert.alert('Pro gerekli', reason, [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Pro\'ya Geç', onPress: () => router.push('/paywall') },
        ])
        return
      }
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

    if (!saved[key]) await incrementTodaySaveCount()
    setSaved((prev) => ({ ...prev, [key]: true }))
    savedLoaded.current = true

    const all = await listSavedWords()
    if (all.length >= 3) void markJourneyStep('save3')
  }

  async function retryTip() {
    const last = lastLookup.current
    if (!last) return
    await openWordTip(last.word, last.sentence)
  }

  return {
    tip,
    setTip,
    saved,
    isSaved: !!saved[tip?.word?.toLowerCase() || ''],
    getCacheEntry,
    openWordTip,
    saveTip,
    retryTip,
    closeTip: () => setTip(null),
  }
}

