import { useCallback, useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { colors } from '../../lib/theme'
import { SelectableReaderText } from './SelectableReaderText'
import { SelectionToolbar } from './SelectionToolbar'
import { BatchTranslationSheet } from './BatchTranslationSheet'
import { SentenceTranslationSheet } from './SentenceTranslationSheet'
import { useReaderSelection } from '../../hooks/useReaderSelection'
import { useSentenceTranslate } from '../../hooks/useSentenceTranslate'
import { getSentenceSpan } from '../../lib/sentence'
import { tokenizeText } from '../../lib/tokenize'
import type { TranslationResult } from '../../lib/api'

interface ReaderBlockProps {
  text: string
  onWordTap: (word: string, sentence: string) => void
  activeWord?: string | null
  getCacheEntry?: (word: string) => TranslationResult | undefined
  /** false → segment içi mini çubuk (video gibi) */
  showToolbar?: boolean
  bottomInset?: number
}

/**
 * Tek paragraf / segment için seçilebilir okuyucu.
 * Uzun bas → cümle çevirisi · kısa dokun → kelime.
 */
export function ReaderBlock({
  text,
  onWordTap,
  activeWord,
  getCacheEntry,
  showToolbar = true,
  bottomInset = 0,
}: ReaderBlockProps) {
  const tokens = useMemo(() => tokenizeText(text), [text])

  const getSentence = useCallback(
    (index: number) =>
      tokens.slice(Math.max(0, index - 5), index + 6).map((t) => t.val).join(''),
    [tokens],
  )

  const selection = useReaderSelection(tokens, getSentence)
  const sentenceTr = useSentenceTranslate(tokens)

  return (
    <View style={[styles.wrap, bottomInset > 0 && { paddingBottom: bottomInset }]}>
      {!showToolbar && !selection.selectionMode ? (
        <TouchableOpacity
          style={styles.selectLink}
          onPress={() => selection.enterSelection(0)}
        >
          <Text style={styles.selectLinkText}>Kelime seç (çoklu çeviri)</Text>
        </TouchableOpacity>
      ) : null}

      <SelectableReaderText
        tokens={tokens}
        selectionMode={selection.selectionMode}
        isSelected={selection.isSelected}
        isInSentence={sentenceTr.isInHighlightedSentence}
        activeWord={activeWord}
        getCacheEntry={getCacheEntry}
        onWordPress={(i) =>
          selection.handleWordPress(i, () => {
            sentenceTr.close()
            const span = getSentenceSpan(tokens, i)
            onWordTap(tokens[i].val, span?.text ?? getSentence(i))
          })
        }
        onWordLongPress={(i) => {
          selection.exitSelection()
          void sentenceTr.translateAt(i)
        }}
      />

      {showToolbar ? (
        <SelectionToolbar
          visible={selection.selectionMode}
          count={selection.count}
          translating={selection.translating}
          onClear={selection.clearSelection}
          onTranslate={selection.translateSelected}
          onClose={selection.exitSelection}
        />
      ) : selection.selectionMode ? (
        <View style={styles.inlineBar}>
          <Text style={styles.inlineCount}>{selection.count} kelime</Text>
          <TouchableOpacity onPress={selection.clearSelection}>
            <Text style={styles.inlineAction}>Temizle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inlineTranslate, selection.count === 0 && { opacity: 0.4 }]}
            onPress={selection.translateSelected}
            disabled={selection.count === 0 || selection.translating}
          >
            {selection.translating ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.inlineTranslateText}>Çevir</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={selection.exitSelection} hitSlop={8}>
            <Text style={styles.inlineAction}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <BatchTranslationSheet
        visible={selection.sheetVisible}
        items={selection.translations}
        loading={selection.translating}
        onClose={() => selection.setSheetVisible(false)}
      />

      <SentenceTranslationSheet
        visible={sentenceTr.visible}
        original={sentenceTr.span?.text ?? null}
        translation={sentenceTr.tr}
        loading={sentenceTr.loading}
        error={sentenceTr.error}
        onClose={sentenceTr.close}
        onRetry={() => {
          if (sentenceTr.span) {
            const mid = Math.floor((sentenceTr.span.start + sentenceTr.span.end) / 2)
            void sentenceTr.translateAt(mid)
          }
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  selectLink: { alignSelf: 'flex-start', marginBottom: 8, paddingVertical: 4 },
  selectLinkText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  inlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(250,204,21,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.2)',
  },
  inlineCount: { flex: 1, color: colors.textDim, fontSize: 12, fontWeight: '600' },
  inlineAction: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  inlineTranslate: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 52,
    alignItems: 'center',
  },
  inlineTranslateText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
})
