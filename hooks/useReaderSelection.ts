import { useCallback, useState } from 'react'
import { BatchTranslationItem, translateWordsBatch } from '../lib/api'
import { TextToken } from '../lib/tokenize'

export function useReaderSelection(
  tokens: TextToken[],
  getSentence: (index: number) => string,
) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [translations, setTranslations] = useState<BatchTranslationItem[] | null>(null)
  const [translating, setTranslating] = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)

  const count = selected.size

  const enterSelection = useCallback((index: number) => {
    setSelectionMode(true)
    setSelected(new Set([index]))
    setTranslations(null)
    setSheetVisible(false)
  }, [])

  const exitSelection = useCallback(() => {
    setSelectionMode(false)
    setSelected(new Set())
    setTranslations(null)
    setSheetVisible(false)
    setTranslating(false)
  }, [])

  const toggleIndex = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    setTranslations(null)
    setSheetVisible(false)
  }, [])

  const translateSelected = useCallback(async () => {
    if (selected.size === 0) return

    const indices = [...selected].sort((a, b) => a - b)
    const words = indices.map((i) => tokens[i]?.val).filter(Boolean) as string[]
    const anchor = indices[Math.floor(indices.length / 2)]
    const sentence = getSentence(anchor)

    setTranslating(true)
    try {
      const items = await translateWordsBatch(words, sentence)
      setTranslations(items)
      setSheetVisible(true)
    } catch (e) {
      console.warn('[reader-selection] batch translate failed:', e)
      setTranslations(words.map((word) => ({ word, error: 'Çeviri alınamadı' })))
      setSheetVisible(true)
    } finally {
      setTranslating(false)
    }
  }, [selected, tokens, getSentence])

  const handleWordPress = useCallback(
    (index: number, onSingleTap: () => void) => {
      if (selectionMode) {
        toggleIndex(index)
        return
      }
      onSingleTap()
    },
    [selectionMode, toggleIndex],
  )

  const handleWordLongPress = useCallback(
    (index: number) => {
      if (!selectionMode) {
        enterSelection(index)
        return
      }
      toggleIndex(index)
    },
    [selectionMode, enterSelection, toggleIndex],
  )

  return {
    selectionMode,
    selected,
    count,
    translations,
    translating,
    sheetVisible,
    setSheetVisible,
    enterSelection,
    exitSelection,
    clearSelection,
    translateSelected,
    handleWordPress,
    handleWordLongPress,
    isSelected: (index: number) => selected.has(index),
  }
}
