import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Speech from 'expo-speech'
import { cefrColors } from '../lib/cefr'
import { colors } from '../lib/theme'

export interface WordTipData {
  word?: string
  tr?: string
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

export function WordTipSheet({ tip, saved, onClose, onSave }: WordTipSheetProps) {
  return (
    <Modal visible={!!tip} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          {tip?.loading ? (
            <ActivityIndicator color={colors.accent} style={{ margin: 32 }} />
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
                  </View>
                  {tip.ipa ? <Text style={styles.ipa}>{tip.ipa}</Text> : null}
                </View>
                {tip.word ? (
                  <TouchableOpacity onPress={() => Speech.speak(tip.word!, { language: 'en-US', rate: 0.8 })}>
                    <Text style={styles.speakBtn}>🔊</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.translation}>{tip.tr}</Text>
              {tip.context ? <Text style={styles.context}>{tip.context}</Text> : null}
              {tip.examples?.length ? (
                <View style={styles.examples}>
                  {tip.examples.slice(0, 2).map((example, index) => (
                    <Text key={index} style={styles.example}>- {example}</Text>
                  ))}
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.saveBtn, saved && styles.saveBtnSaved]}
                onPress={onSave}
              >
                <Text style={[styles.saveBtnText, saved && styles.saveBtnTextSaved]}>
                  {saved ? 'Kaydedildi' : '+ Kaydet'}
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
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, minHeight: 200 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetWord: { fontSize: 28, fontWeight: '800', color: colors.text },
  cefrBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  cefrText: { fontSize: 11, fontWeight: '700' },
  ipa: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: 6 },
  speakBtn: { fontSize: 28, marginLeft: 8 },
  translation: { fontSize: 22, color: colors.accent, fontWeight: '600', marginBottom: 8 },
  context: { color: colors.textDim, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  examples: { marginBottom: 16 },
  example: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  saveBtn: { backgroundColor: colors.accent, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnSaved: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: colors.border },
  saveBtnText: { color: colors.bg, fontWeight: '700', fontSize: 15 },
  saveBtnTextSaved: { color: colors.text },
})
