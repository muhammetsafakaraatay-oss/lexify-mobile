import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Speech from 'expo-speech'
import { cefrColors } from '../lib/cefr'
import { colors } from '../lib/theme'

export interface WordTipData {
  word?: string
  tr?: string
  type?: string
  context?: string
  example?: string
  examples?: string[]
  ipa?: string
  cefr?: string
  loading?: boolean
}

interface WordTipSheetProps {
  tip: WordTipData | null
  saved: boolean
  onClose: () => void
  onSave: () => void
}

function typeLabel(type?: string) {
  if (!type) return null
  const map: Record<string, string> = {
    noun: 'isim', verb: 'fiil', adjective: 'sıfat', adverb: 'zarf',
    pronoun: 'zamir', preposition: 'edat', conjunction: 'bağlaç',
    interjection: 'ünlem', article: 'article', phrase: 'deyim',
  }
  return map[type.toLowerCase()] || type
}

export function WordTipSheet({ tip, saved, onClose, onSave }: WordTipSheetProps) {
  return (
    <Modal visible={!!tip} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dragHandle} />

          {tip?.loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loadingText}>Çevriliyor...</Text>
            </View>
          ) : tip ? (
            <>
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.sheetWord}>{tip.word}</Text>
                    {tip.cefr ? (
                      <View style={[styles.cefrBadge, { borderColor: cefrColors[tip.cefr] }]}>
                        <Text style={[styles.cefrText, { color: cefrColors[tip.cefr] }]}>{tip.cefr}</Text>
                      </View>
                    ) : null}
                    {tip.type ? (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeText}>{typeLabel(tip.type)}</Text>
                      </View>
                    ) : null}
                  </View>
                  {tip.ipa ? <Text style={styles.ipa}>/{tip.ipa}/</Text> : null}
                </View>
                {tip.word ? (
                  <TouchableOpacity
                    style={styles.speakBtnArea}
                    onPress={() => Speech.speak(tip.word!, { language: 'en-US', rate: 0.8 })}
                  >
                    <Text style={styles.speakBtn}>🔊</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.translationRow}>
                <Text style={styles.translation}>{tip.tr}</Text>
              </View>

              {tip.context ? (
                <View style={styles.contextCard}>
                  <Text style={styles.contextLabel}>BAĞLAM</Text>
                  <Text style={styles.context}>{tip.context}</Text>
                </View>
              ) : null}

              {tip.examples?.length ? (
                <View style={styles.examples}>
                  <Text style={styles.examplesLabel}>ÖRNEKLER</Text>
                  {tip.examples.slice(0, 2).map((example, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.exampleRow}
                      onPress={() => Speech.speak(example, { language: 'en-US', rate: 0.85 })}
                    >
                      <Text style={styles.exampleBullet}>▸</Text>
                      <Text style={styles.example}>{example}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.saveBtn, saved && styles.saveBtnSaved]}
                onPress={onSave}
              >
                <Text style={[styles.saveBtnText, saved && styles.saveBtnTextSaved]}>
                  {saved ? '✓ Kaydedildi' : '+ Kelimeyi Kaydet'}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0f0f0f', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingTop: 12, minHeight: 200,
    borderWidth: 1, borderBottomWidth: 0, borderColor: '#222',
  },
  dragHandle: {
    width: 40, height: 4, backgroundColor: '#333', borderRadius: 2,
    alignSelf: 'center', marginBottom: 20,
  },
  loadingArea: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  sheetWord: { fontSize: 28, fontWeight: '800', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  typeBadge: { backgroundColor: '#1a1a1a', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  ipa: { color: colors.textMuted, fontSize: 14, fontFamily: 'Courier', marginTop: 2 },
  speakBtnArea: { padding: 4, marginLeft: 8 },
  speakBtn: { fontSize: 26 },
  translationRow: { marginBottom: 14 },
  translation: { fontSize: 24, color: colors.accent, fontWeight: '700' },
  contextCard: { backgroundColor: '#141414', borderRadius: 10, padding: 12, marginBottom: 12 },
  contextLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 5 },
  context: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  examples: { marginBottom: 16 },
  examplesLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  exampleRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  exampleBullet: { color: colors.accent, fontSize: 12, marginTop: 3 },
  example: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 4 },
  saveBtnSaved: { backgroundColor: '#181818', borderWidth: 1, borderColor: '#2a2a2a' },
  saveBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  saveBtnTextSaved: { color: colors.textMuted },
})
