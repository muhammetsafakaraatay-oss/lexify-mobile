import { useState } from 'react'
import {
  Modal, Pressable, View, Text, StyleSheet,
  TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native'
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { BatchTranslationItem } from '../../lib/api'
import { cefrColors } from '../../lib/cefr'
import { colors } from '../../lib/theme'
import { speak } from '../../lib/speech'

interface BatchTranslationSheetProps {
  visible: boolean
  items: BatchTranslationItem[] | null
  loading?: boolean
  onClose: () => void
}

export function BatchTranslationSheet({
  visible,
  items,
  loading,
  onClose,
}: BatchTranslationSheetProps) {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})

  function toggleFlip(word: string) {
    const key = word.toLowerCase()
    setFlipped((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const list = items ?? []

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Animated.View entering={SlideInDown.duration(280).springify()}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>TOPLU ÇEVİRİ</Text>
                <Text style={styles.title}>
                  {loading ? 'Çevriliyor…' : `${list.length} kelime`}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>Türkçeye dokun → İngilizce kelimeyi gör</Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {list.map((item) => {
                  const key = item.word.toLowerCase()
                  const showEn = flipped[key]
                  const hasTr = !!item.tr && !item.error

                  return (
                    <Animated.View key={key} entering={FadeIn.duration(200)}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.row,
                          pressed && styles.rowPressed,
                          showEn && styles.rowFlipped,
                        ]}
                        onPress={() => {
                          if (hasTr) toggleFlip(item.word)
                          else speak(item.word)
                        }}
                      >
                        <View style={styles.rowMain}>
                          {showEn ? (
                            <>
                              <Text style={styles.enPrimary}>{item.word}</Text>
                              {item.ipa ? <Text style={styles.ipa}>/{item.ipa}/</Text> : null}
                              {hasTr ? (
                                <Text style={styles.trSecondary}>{item.tr}</Text>
                              ) : (
                                <Text style={styles.errorText}>{item.error || 'Çeviri yok'}</Text>
                              )}
                            </>
                          ) : (
                            <>
                              {hasTr ? (
                                <Text style={styles.trPrimary}>{item.tr}</Text>
                              ) : (
                                <Text style={styles.trPrimaryMuted}>{item.word}</Text>
                              )}
                              <Text style={styles.enSecondary}>{item.word}</Text>
                            </>
                          )}
                        </View>

                        <View style={styles.rowRight}>
                          {item.cefr ? (
                            <View style={[styles.cefrBadge, { borderColor: cefrColors[item.cefr] || colors.border }]}>
                              <Text style={[styles.cefrText, { color: cefrColors[item.cefr] || colors.textMuted }]}>
                                {item.cefr}
                              </Text>
                            </View>
                          ) : null}
                          <TouchableOpacity
                            onPress={() => speak(item.word)}
                            hitSlop={10}
                            style={styles.speakBtn}
                          >
                            <Ionicons name="volume-medium-outline" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      </Pressable>
                    </Animated.View>
                  )
                })}
              </ScrollView>
            )}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    maxHeight: '72%',
    paddingBottom: 24,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  eyebrow: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  list: { maxHeight: 420 },
  listContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: '#181818' },
  rowFlipped: { borderColor: 'rgba(250,204,21,0.25)' },
  rowMain: { flex: 1 },
  trPrimary: { color: colors.text, fontSize: 17, fontWeight: '700', lineHeight: 22 },
  trPrimaryMuted: { color: colors.textMuted, fontSize: 17, fontWeight: '600' },
  enSecondary: { color: colors.textMuted, fontSize: 13, marginTop: 3, fontWeight: '500' },
  enPrimary: { color: colors.accent, fontSize: 17, fontWeight: '800' },
  trSecondary: { color: colors.textMuted, fontSize: 14, marginTop: 4, lineHeight: 20 },
  ipa: { color: colors.textDim, fontSize: 12, fontFamily: 'Courier', marginTop: 2 },
  errorText: { color: '#f87171', fontSize: 13, marginTop: 4 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  cefrBadge: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  cefrText: { fontSize: 10, fontWeight: '700' },
  speakBtn: { padding: 2 },
})
