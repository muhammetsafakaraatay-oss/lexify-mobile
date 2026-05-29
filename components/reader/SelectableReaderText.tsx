import { Platform, Text, View, StyleSheet } from 'react-native'
import { TextToken } from '../../lib/tokenize'
import { colors } from '../../lib/theme'
import type { TranslationResult } from '../../lib/api'
import { TouchableWord } from './TouchableWord'

/** Tarayıcı / OS metin seçimini kapat — sadece kelime dokunma / uzun basma kalsın */
const noNativeSelection = Platform.select({
  web: {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  } as const,
  default: {},
})

interface SelectableReaderTextProps {
  tokens: TextToken[]
  selectionMode: boolean
  isSelected: (index: number) => boolean
  isInSentence?: (index: number) => boolean
  activeWord?: string | null
  getCacheEntry?: (word: string) => TranslationResult | undefined
  cefrHighlight?: Record<string, string>
  contextBridgeMatches?: Record<number, { translation?: string }>
  onWordPress: (index: number) => void
  onWordLongPress: (index: number) => void
  textStyle?: object
}

export function SelectableReaderText({
  tokens,
  selectionMode,
  isSelected,
  isInSentence,
  activeWord,
  getCacheEntry,
  cefrHighlight = {},
  contextBridgeMatches = {},
  onWordPress,
  onWordLongPress,
  textStyle,
}: SelectableReaderTextProps) {
  return (
    <View
      style={[styles.wrap, noNativeSelection]}
      {...(Platform.OS === 'web'
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSelectStart: (e: any) => e.preventDefault?.(),
          }
        : {})}
    >
      <Text
        selectable={false}
        style={[styles.readText, textStyle, noNativeSelection]}
      >
        {tokens.map((t, i) =>
          t.word ? (
            <TouchableWord
              key={i}
              onPress={() => onWordPress(i)}
              onLongPress={() => onWordLongPress(i)}
              style={[
                styles.word,
                noNativeSelection,
                isInSentence?.(i) && styles.wordSentence,
                selectionMode && isSelected(i) && styles.wordSelected,
                !selectionMode && getCacheEntry?.(t.val)?.cefr && {
                  backgroundColor: cefrHighlight[getCacheEntry(t.val)?.cefr || ''] || 'transparent',
                  borderRadius: 3,
                },
                !selectionMode && contextBridgeMatches[i] && styles.wordBridge,
                !selectionMode && activeWord?.toLowerCase() === t.val.toLowerCase() && styles.wordActive,
              ]}
            >
              {t.val}
            </TouchableWord>
          ) : (
            <Text key={i} selectable={false} style={[styles.punct, noNativeSelection]}>
              {t.val}
            </Text>
          ),
        )}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {},
  readText: { fontSize: 18, lineHeight: 32, color: colors.text },
  word: { color: colors.text },
  wordSentence: {
    backgroundColor: 'rgba(96,165,250,0.18)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(96,165,250,0.5)',
  },
  wordSelected: {
    backgroundColor: 'rgba(250,204,21,0.14)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(250,204,21,0.55)',
  },
  wordBridge: {
    backgroundColor: 'rgba(250,204,21,0.14)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(250,204,21,0.85)',
    borderRadius: 3,
  },
  wordActive: { backgroundColor: 'rgba(250,204,21,0.22)', borderRadius: 3 },
  punct: { color: colors.text },
})
