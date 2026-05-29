import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import {
  deleteSet, getSet, populateSet, resetMastery, type PopulatedSet,
} from '../../../lib/sets'

type ModeDef = {
  key: 'flashcards' | 'learn' | 'match'
  title: string
  subtitle: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
  route: (id: string) => string
}

const MODES: ModeDef[] = [
  {
    key: 'flashcards',
    title: 'Flashcards',
    subtitle: 'Klasik çevir-geç kartlar · sağa sola kaydır',
    icon: 'albums',
    tint: '#facc15',
    route: (id) => `/sets/${id}/flashcards`,
  },
  {
    key: 'learn',
    title: 'Learn',
    subtitle: 'Adaptif round-robin · çoktan seçmeli → yazılı',
    icon: 'school',
    tint: '#60a5fa',
    route: (id) => `/sets/${id}/learn`,
  },
  {
    key: 'match',
    title: 'Match',
    subtitle: 'Eşleştirme · zamana karşı yarış',
    icon: 'grid',
    tint: '#a855f7',
    route: (id) => `/sets/${id}/match`,
  },
]

export default function SetDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [set, setSet] = useState<PopulatedSet | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const raw = await getSet(id)
    const populated = await populateSet(raw)
    setSet(populated)
    setLoading(false)
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  function handleDelete() {
    if (!set) return
    Alert.alert(
      'Seti sil',
      `"${set.name}" silinsin mi? Setteki kelimeler kayıtlı kalır, sadece grup silinir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await deleteSet(set.id)
            router.back()
          },
        },
      ],
    )
  }

  function handleReset() {
    if (!set) return
    Alert.alert(
      'İlerlemeyi sıfırla',
      'Bu setteki tüm "öğrenildi" rozetleri silinsin mi? (Setteki kelimeler aynı kalır.)',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            await resetMastery(set.id)
            await load()
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (!set) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Set bulunamadı</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Geri dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const total = set.terms.length
  const masteredCount = set.masteredCount
  const percent = total > 0 ? Math.round((masteredCount / total) * 100) : 0
  const canStudy = total > 0
  const matchEnabled = total >= 4

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{set.name}</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash-outline" size={20} color="#f87171" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Hero / progress */}
        <View style={styles.hero}>
          {set.description ? (
            <Text style={styles.heroDesc}>{set.description}</Text>
          ) : null}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{total}</Text>
              <Text style={styles.heroStatLabel}>terim</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: '#4ade80' }]}>{masteredCount}</Text>
              <Text style={styles.heroStatLabel}>öğrenildi</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: colors.accent }]}>{percent}%</Text>
              <Text style={styles.heroStatLabel}>ilerleme</Text>
            </View>
            {set.bestMatchSeconds !== undefined ? (
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: '#60a5fa' }]}>{set.bestMatchSeconds.toFixed(1)}s</Text>
                <Text style={styles.heroStatLabel}>match</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>

          {masteredCount > 0 ? (
            <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
              <Ionicons name="refresh-outline" size={13} color={colors.textMuted} />
              <Text style={styles.resetBtnText}>İlerlemeyi sıfırla</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Mode picker */}
        <Text style={styles.sectionLabel}>ÇALIŞMA MODLARI</Text>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {MODES.map((mode) => {
            const disabled = !canStudy || (mode.key === 'match' && !matchEnabled)
            return (
              <TouchableOpacity
                key={mode.key}
                style={[styles.modeCard, disabled && styles.modeCardDisabled]}
                activeOpacity={0.86}
                disabled={disabled}
                onPress={() => router.push(mode.route(set.id))}
              >
                <View style={[styles.modeIcon, { backgroundColor: `${mode.tint}1f`, borderColor: `${mode.tint}66` }]}>
                  <Ionicons name={mode.icon} size={22} color={mode.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>{mode.title}</Text>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                  {disabled && mode.key === 'match' ? (
                    <Text style={styles.modeHint}>Match için en az 4 kelime gerekli</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Term list */}
        <Text style={styles.sectionLabel}>TERİMLER</Text>
        <View style={{ paddingHorizontal: 20, gap: 6 }}>
          {set.terms.map((w) => {
            const m = set.mastery[w.id] ?? 0
            const isMastered = m >= 1
            return (
              <View key={w.id} style={styles.termRow}>
                <View style={[styles.dot, { backgroundColor: isMastered ? '#4ade80' : colors.textMuted }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.termWord}>{w.word}</Text>
                  {w.translation ? (
                    <Text style={styles.termTr} numberOfLines={1}>{w.translation}</Text>
                  ) : null}
                </View>
                {isMastered ? (
                  <Ionicons name="checkmark-done" size={16} color="#4ade80" />
                ) : null}
              </View>
            )
          })}
          {set.terms.length === 0 ? (
            <Text style={styles.termTr}>Bu sette terim kalmamış (kelimeler silinmiş olabilir).</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 12,
  },
  topTitle: { flex: 1, color: colors.text, fontSize: 19, fontWeight: '800', marginHorizontal: 8 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  backBtnText: { color: colors.accent, fontWeight: '800' },

  hero: {
    marginHorizontal: 20, marginBottom: 18, padding: 18,
    backgroundColor: colors.bgCard, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, gap: 14,
  },
  heroDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  heroStatsRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  heroStat: { minWidth: 60 },
  heroStatValue: { color: colors.text, fontSize: 22, fontWeight: '900' },
  heroStatLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  resetBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  resetBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },

  sectionLabel: {
    color: colors.textMuted, fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, paddingHorizontal: 20, marginTop: 4, marginBottom: 8,
  },

  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14,
  },
  modeCardDisabled: { opacity: 0.45 },
  modeIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  modeTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  modeSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  modeHint: { color: '#fb923c', fontSize: 11, fontWeight: '700', marginTop: 4 },

  termRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: colors.bgCard, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  termWord: { color: colors.text, fontSize: 14, fontWeight: '700' },
  termTr: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
})
