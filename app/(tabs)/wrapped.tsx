import { useCallback, useMemo, useRef, useState } from 'react'
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { buildWeeklyWrapped, WeeklyWrappedPayload } from '../../lib/wrapped'
import { listSavedWords } from '../../lib/data'
import { supabase } from '../../lib/supabase'
import { usePremium } from '../../contexts/SubscriptionContext'

const { width } = Dimensions.get('window')

export default function WrappedScreen() {
  const router = useRouter()
  const { isPro } = usePremium()
  const scrollRef = useRef<ScrollView>(null)
  const [payload, setPayload] = useState<WeeklyWrappedPayload | null>(null)
  const [index, setIndex] = useState(0)

  const load = useCallback(async () => {
    const [{ data: auth }, savedWords, historyRes] = await Promise.all([
      supabase.auth.getUser(),
      listSavedWords({ orderBy: 'created_at', ascending: false }),
      authUserHistory(),
    ])
    const next = await buildWeeklyWrapped({
      savedWords,
      readingHistory: historyRes,
      userId: auth.user?.id || 'guest',
      isPro,
    })
    setPayload(next)
    setIndex(0)
  }, [isPro])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const cards = payload?.cards || []
  const canShare = Boolean(payload?.shareText)

  function onMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(event.nativeEvent.contentOffset.x / width)
    setIndex(next)
  }

  async function authUserHistory() {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return []
    const { data } = await supabase
      .from('reading_history')
      .select('*')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false })
      .limit(24)
    return data || []
  }

  const active = useMemo(() => cards[index], [cards, index])

  if (!payload) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.emptyTitle}>Wrapped henüz hazır değil</Text>
          <Text style={styles.emptyText}>
            Birkaç gün daha okuma ve kelime kaydı yaptığında haftalık özetin burada belirecek.
          </Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.push('/(tabs)/oku')}>
            <Text style={styles.ctaText}>Okumaya Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topEyebrow}>WEEKLY WRAPPED</Text>
          <Text style={styles.topTitle}>Bu haftan</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (canShare) void Share.share({ message: payload.shareText })
          }}
          style={styles.shareBtn}
        >
          <Ionicons name="share-outline" size={18} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressRow}>
        {cards.map((card, cardIndex) => (
          <View key={card.id} style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { opacity: cardIndex <= index ? 1 : 0.2 },
              ]}
            />
          </View>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
      >
        {cards.map((card) => (
          <View key={card.id} style={styles.slide}>
            <View style={[styles.card, card.accent ? { borderColor: `${card.accent}55` } : null]}>
              <Text style={[styles.eyebrow, card.accent ? { color: card.accent } : null]}>{card.eyebrow}</Text>
              <Text style={styles.title}>{card.title}</Text>
              <Text style={styles.body}>{card.body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Text style={styles.stepText}>{index + 1} / {cards.length}</Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              const next = Math.max(0, index - 1)
              scrollRef.current?.scrollTo({ x: next * width, animated: true })
              setIndex(next)
            }}
            disabled={index === 0}
          >
            <Text style={[styles.secondaryText, index === 0 && { opacity: 0.35 }]}>Geri</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              if (index >= cards.length - 1) {
                router.push('/(tabs)/dashboard')
                return
              }
              const next = index + 1
              scrollRef.current?.scrollTo({ x: next * width, animated: true })
              setIndex(next)
            }}
          >
            <Text style={styles.primaryText}>{index >= cards.length - 1 ? 'Bitir' : 'İleri'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  topCenter: { alignItems: 'center' },
  topEyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  topTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 2 },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 18, marginBottom: 18 },
  progressTrack: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: 999 },
  slide: { width, paddingHorizontal: 18 },
  card: {
    minHeight: 500,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: 28,
    justifyContent: 'center',
  },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 12 },
  title: { color: colors.text, fontSize: 34, fontWeight: '900', lineHeight: 40, marginBottom: 16 },
  body: { color: colors.textMuted, fontSize: 18, lineHeight: 29 },
  bottomBar: { paddingHorizontal: 18, paddingVertical: 18, gap: 12 },
  stepText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  primaryBtn: { flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.accent },
  secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  primaryText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
  emptyWrap: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'flex-start' },
  emptyTitle: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: 10, marginTop: 24 },
  emptyText: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 18 },
  cta: { backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14 },
  ctaText: { color: colors.bg, fontSize: 14, fontWeight: '800' },
})
