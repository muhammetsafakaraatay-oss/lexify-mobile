import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { listSavedWords } from '../../lib/data'
import { buildPassportProgress, passportFocusHint } from '../../lib/passport'
import { colors } from '../../lib/theme'
import { cefrColors } from '../../lib/cefr'

export default function PassportScreen() {
  const router = useRouter()
  const [levels, setLevels] = useState<ReturnType<typeof buildPassportProgress>>([])

  const load = useCallback(async () => {
    const words = await listSavedWords({ orderBy: 'created_at', ascending: false })
    setLevels(buildPassportProgress(words))
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>CEFR Pasaportu</Text>
        <Text style={styles.subtitle}>A1’den C2’ye yolculuğunu durak durak gör. Her seviye ayrı bir kilometre taşı.</Text>

        <View style={styles.path}>
          {levels.map((item, index) => (
            <View key={item.level} style={styles.stopRow}>
              <View style={styles.leftRail}>
                <View style={[styles.stopDot, { backgroundColor: cefrColors[item.level] || colors.accent, opacity: item.unlocked ? 1 : 0.35 }]} />
                {index < levels.length - 1 ? <View style={styles.stopLine} /> : null}
              </View>
              <View style={styles.stopCard}>
                <View style={styles.stopHeader}>
                  <Text style={[styles.stopLevel, { color: cefrColors[item.level] || colors.text }]}>{item.level}</Text>
                  <Text style={styles.stopPct}>{item.pct}%</Text>
                </View>
                <Text style={styles.stopMeta}>{item.known} / {item.target} kelime</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${item.pct}%`, backgroundColor: cefrColors[item.level] || colors.accent }]} />
                </View>
                <Text style={styles.stopStatus}>
                  {item.completed ? 'Tamamlandı' : item.unlocked ? 'Açıldı' : 'Henüz kilitli'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.focusCard}>
          <Text style={styles.focusTitle}>Şimdi neye odaklanmalı?</Text>
          <Text style={styles.focusText}>{passportFocusHint(levels)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 12, paddingBottom: 40 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 20 },
  path: { gap: 0, marginBottom: 20 },
  stopRow: { flexDirection: 'row', gap: 14 },
  leftRail: { width: 26, alignItems: 'center' },
  stopDot: { width: 16, height: 16, borderRadius: 8, marginTop: 20 },
  stopLine: { width: 2, flex: 1, backgroundColor: colors.border, minHeight: 80 },
  stopCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  stopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stopLevel: { fontSize: 20, fontWeight: '800' },
  stopPct: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  stopMeta: { color: colors.textMuted, fontSize: 13, marginBottom: 10 },
  barBg: { height: 8, backgroundColor: '#1a1a1a', borderRadius: 999, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 999 },
  stopStatus: { color: colors.text, fontSize: 12, fontWeight: '700' },
  focusCard: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  focusTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  focusText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
})
