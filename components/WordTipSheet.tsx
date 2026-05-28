import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { speak } from '../lib/speech'
import { cefrColors, cefrLabels } from '../lib/cefr'
import { colors } from '../lib/theme'
import { Ionicons } from '@expo/vector-icons'

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
  const cefrInfo = tip?.cefr ? cefrLabels[tip.cefr] : null
  const cefrColor = tip?.cefr ? cefrColors[tip.cefr] : null

  return (
    <Modal visible={!!tip} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.dragHandle} />

          {tip?.loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loadingText}>Çevriliyor...</Text>
            </View>
          ) : tip ? (
            <>
              {/* ── Word + IPA + speak ── */}
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.sheetWord}>{tip.word}</Text>
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
                    style={styles.speakBtn}
                    onPress={() => speak(tip.word!)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="volume-medium-outline" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* ── Translation ── */}
              <Text style={styles.translation}>{tip.tr}</Text>

              {/* ── CEFR block — prominent card ── */}
              {tip.cefr && cefrInfo && cefrColor ? (
                <View style={[styles.cefrCard, { borderColor: cefrColor + '55', backgroundColor: cefrColor + '12' }]}>
                  <View style={styles.cefrCardLeft}>
                    <View style={[styles.cefrBadgeLarge, { backgroundColor: cefrColor + '22', borderColor: cefrColor }]}>
                      <Text style={[styles.cefrBadgeLargeText, { color: cefrColor }]}>{tip.cefr}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cefrLevelName, { color: cefrColor }]}>
                        {cefrInfo.tr} · <Text style={styles.cefrLevelNameEn}>{cefrInfo.en}</Text>
                      </Text>
                      <Text style={styles.cefrDesc}>{cefrInfo.desc}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* ── Context ── */}
              {tip.context ? (
                <View style={styles.contextCard}>
                  <Text style={styles.contextLabel}>BAĞLAM</Text>
                  <Text style={styles.context}>{tip.context}</Text>
                </View>
              ) : null}

              {/* ── Examples ── */}
              {tip.examples?.length ? (
                <View style={styles.examples}>
                  <Text style={styles.examplesLabel}>ÖRNEKLER</Text>
                  {tip.examples.slice(0, 2).map((ex, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.exampleRow}
                      onPress={() => speak(ex)}
                    >
                      <Ionicons name="play-circle-outline" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                      <Text style={styles.example}>{ex}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {/* ── Save button ── */}
              <TouchableOpacity
                style={[styles.saveBtn, saved && styles.saveBtnSaved]}
                onPress={onSave}
              >
                {saved
                  ? <Ionicons name="checkmark-circle-outline" size={18} color={colors.textMuted} />
                  : <Ionicons name="bookmark-outline" size={18} color={colors.bg} />
                }
                <Text style={[styles.saveBtnText, saved && styles.saveBtnTextSaved]}>
                  {saved ? 'Kaydedildi' : 'Kelimeyi Kaydet'}
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
    backgroundColor: '#0f0f0f',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 24, paddingTop: 12, minHeight: 220,
    borderWidth: 1, borderBottomWidth: 0, borderColor: '#222',
  },
  dragHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  loadingArea: { alignItems: 'center', paddingVertical: 36, gap: 14 },
  loadingText: { color: colors.textMuted, fontSize: 14 },

  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  sheetWord: { fontSize: 28, fontWeight: '800', color: colors.text },
  typeBadge: { backgroundColor: '#1a1a1a', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  ipa: { color: colors.textMuted, fontSize: 14, fontFamily: 'Courier', marginTop: 2 },
  speakBtn: { padding: 4, marginLeft: 8 },

  translation: { fontSize: 26, color: colors.accent, fontWeight: '700', marginBottom: 12 },

  // CEFR card
  cefrCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  cefrCardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cefrBadgeLarge: {
    width: 48, height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  cefrBadgeLargeText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },
  cefrLevelName: { fontSize: 13, fontWeight: '800', marginBottom: 3 },
  cefrLevelNameEn: { fontWeight: '500', fontSize: 12 },
  cefrDesc: { fontSize: 12, color: colors.textDim, lineHeight: 17 },

  contextCard: { backgroundColor: '#141414', borderRadius: 12, padding: 12, marginBottom: 12 },
  contextLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 5 },
  context: { color: colors.textDim, fontSize: 13, lineHeight: 20 },

  examples: { marginBottom: 16 },
  examplesLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  exampleRow: { flexDirection: 'row', gap: 8, marginBottom: 7 },
  example: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 20 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 14, padding: 15, marginTop: 4 },
  saveBtnSaved: { backgroundColor: '#181818', borderWidth: 1, borderColor: '#2a2a2a' },
  saveBtnText: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  saveBtnTextSaved: { color: colors.textMuted },
})
