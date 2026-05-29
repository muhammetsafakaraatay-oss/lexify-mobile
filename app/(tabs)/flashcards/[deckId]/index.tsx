import { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../../lib/theme'
import {
  getDeckWithProgress, deleteDeck, resetDeckProgress, NotSignedInError,
  type DeckWithProgress,
} from '../../../../lib/flashcards'

type ModeKey = 'flip' | 'review' | 'match'

const MODES: Array<{
  key: ModeKey
  title: string
  subtitle: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
  route: (id: string) => string
}> = [
  {
    key: 'flip',
    title: 'Flip Mode',
    subtitle: 'Klasik kart çevirme · sağa/sola kaydır',
    icon: 'sync',
    tint: '#facc15',
    route: (id) => `/flashcards/${id}/study?mode=flip`,
  },
  {
    key: 'review',
    title: 'Review Mode',
    subtitle: 'Biliyorum / bilmiyorum ile akıllı tekrar',
    icon: 'checkbox',
    tint: '#4ade80',
    route: (id) => `/flashcards/${id}/study?mode=review`,
  },
  {
    key: 'match',
    title: 'Match Mode',
    subtitle: 'Eşleştirme · zamana karşı yarış',
    icon: 'grid',
    tint: '#a855f7',
    route: (id) => `/flashcards/${id}/match`,
  },
]

export default function DeckHome() {
  const router = useRouter()
  const { deckId } = useLocalSearchParams<{ deckId: string }>()
  const [deck, setDeck] = useState<DeckWithProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!deckId) return
    setLoading(true)
    setError(null)
    try {
      const d = await getDeckWithProgress(deckId)
      setDeck(d)
    } catch (e: any) {
      if (e instanceof NotSignedInError) {
        setError('Giriş yapmalısın. Profile gidip giriş yaptıktan sonra geri dön.')
      } else {
        setError(e?.message || 'Deste yüklenemedi')
      }
    } finally {
      setLoading(false)
    }
  }, [deckId])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  function handleDelete() {
    if (!deck) return
    Alert.alert(
      'Desteyi sil',
      `"${deck.title}" silinsin mi? Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDeck(deck.id)
              router.back()
            } catch (e: any) {
              Alert.alert('Silinemedi', e?.message || 'Bilinmeyen hata')
            }
          },
        },
      ],
    )
  }

  function handleReset() {
    if (!deck) return
    Alert.alert(
      'İlerlemeyi sıfırla',
      'Bu destedeki tüm kartlar "unseen" durumuna döndürülsün mü?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetDeckProgress(deck.id)
              await load()
            } catch (e: any) {
              Alert.alert('Sıfırlanamadı', e?.message || 'Bilinmeyen hata')
            }
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

  if (error || !deck) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={32} color="#f87171" />
          <Text style={styles.errText}>{error || 'Deste bulunamadı'}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Geri dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  const p = deck.progress
  const canStudy = p.total > 0
  const matchEnabled = p.total >= 4

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{deck.title}</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="trash-outline" size={20} color="#f87171" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.hero}>
          {deck.description ? (
            <Text style={styles.heroDesc}>{deck.description}</Text>
          ) : null}

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{p.total}</Text>
              <Text style={styles.heroStatLabel}>kart</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: '#4ade80' }]}>{p.known}</Text>
              <Text style={styles.heroStatLabel}>biliyorum</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: '#f87171' }]}>{p.unknown}</Text>
              <Text style={styles.heroStatLabel}>tekrar</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: colors.accent }]}>{p.percent}%</Text>
              <Text style={styles.heroStatLabel}>ilerleme</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${p.percent}%` }]} />
          </View>

          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              onPress={() => router.push(`/flashcards/${deck.id}/edit`)}
              style={styles.actionBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={14} color={colors.text} />
              <Text style={styles.actionBtnText}>Düzenle</Text>
            </TouchableOpacity>

            {p.known + p.unknown > 0 ? (
              <TouchableOpacity onPress={handleReset} style={styles.actionBtn}>
                <Ionicons name="refresh-outline" size={14} color={colors.text} />
                <Text style={styles.actionBtnText}>Sıfırla</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

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
                onPress={() => router.push(mode.route(deck.id))}
              >
                <View style={[styles.modeIcon, { backgroundColor: `${mode.tint}1f`, borderColor: `${mode.tint}66` }]}>
                  <Ionicons name={mode.icon} size={22} color={mode.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeTitle}>{mode.title}</Text>
                  <Text style={styles.modeSubtitle}>{mode.subtitle}</Text>
                  {disabled && !canStudy ? (
                    <Text style={styles.modeHint}>Önce karta ihtiyacın var — Düzenle&apos;den ekle</Text>
                  ) : disabled && mode.key === 'match' ? (
                    <Text style={styles.modeHint}>Match için en az 4 kart gerekli</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )
          })}
        </View>

        {!canStudy ? (
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <TouchableOpacity
              onPress={() => router.push(`/flashcards/${deck.id}/edit`)}
              style={styles.addCardCta}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color={colors.bg} />
              <Text style={styles.addCardCtaText}>Kart ekle</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  errText: { color: colors.text, fontSize: 14, textAlign: 'center' },
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
  heroActionsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 999,
  },
  actionBtnText: { color: colors.text, fontSize: 12, fontWeight: '700' },

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

  addCardCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.accent, paddingVertical: 13, borderRadius: 14,
  },
  addCardCtaText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
})
