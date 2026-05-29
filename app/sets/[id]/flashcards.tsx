import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Pressable, PanResponder,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../../lib/theme'
import { speak } from '../../../lib/speech'
import { bumpMastery, getSet, populateSet, type PopulatedSet } from '../../../lib/sets'
import type { SavedWord } from '../../../lib/data'

const { width, height } = Dimensions.get('window')
const CARD_W = Math.min(width - 40, 400)
const CARD_H = Math.min(height * 0.46, 340)
const SWIPE_THRESHOLD = Math.min(110, CARD_W * 0.24)

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export default function SetFlashcardsScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [set, setSet] = useState<PopulatedSet | null>(null)
  const [queue, setQueue] = useState<SavedWord[]>([])
  const [stillLearning, setStillLearning] = useState<SavedWord[]>([])
  const [gotIt, setGotIt] = useState<SavedWord[]>([])
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)

  const flipAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const dragX = useRef(new Animated.Value(0)).current
  const dragY = useRef(new Animated.Value(0)).current
  const processing = useRef(false)

  useEffect(() => {
    let alive = true
    if (!id) return
    ;(async () => {
      const raw = await getSet(id)
      const populated = await populateSet(raw)
      if (!alive) return
      setSet(populated)
      const initial = populated ? shuffle(populated.terms) : []
      setQueue(initial)
      setLoading(false)
      if (initial.length === 0) setFinished(true)
    })()
    return () => { alive = false }
  }, [id])

  const word = queue[current]

  function resetDrag() {
    Animated.parallel([
      Animated.spring(dragX, { toValue: 0, useNativeDriver: true, friction: 8, tension: 70 }),
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 70 }),
    ]).start()
  }

  function flip() {
    if (processing.current || flipped) return
    Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 40 }).start()
    setFlipped(true)
    if (word?.word) speak(word.word)
  }

  const advance = useCallback(() => {
    flipAnim.setValue(0)
    slideAnim.setValue(0)
    dragX.setValue(0)
    dragY.setValue(0)
    setFlipped(false)
    processing.current = false
    setCurrent((c) => {
      const next = c + 1
      if (next >= queue.length) {
        // End of round — re-shuffle stillLearning if any
        if (stillLearning.length > 0) {
          setQueue(shuffle(stillLearning))
          setStillLearning([])
          return 0
        }
        setFinished(true)
        return c
      }
      return next
    })
  }, [queue.length, stillLearning, flipAnim, slideAnim, dragX, dragY])

  async function handleAnswer(known: boolean) {
    if (!word || !set || processing.current) return
    processing.current = true
    if (known) {
      setGotIt((g) => [...g, word])
      await bumpMastery(set.id, word.id, 0.34)
    } else {
      setStillLearning((s) => [...s, word])
      await bumpMastery(set.id, word.id, -0.2)
    }
    Animated.timing(slideAnim, {
      toValue: known ? 30 : -30, duration: 130, useNativeDriver: true,
    }).start(advance)
  }

  function handleSwipe(direction: 'left' | 'right') {
    if (processing.current) return
    processing.current = true
    const exit = direction === 'right' ? width + CARD_W : -(width + CARD_W)
    Animated.parallel([
      Animated.timing(dragX, { toValue: exit, duration: 170, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: 0, duration: 170, useNativeDriver: true }),
    ]).start(() => {
      void handleAnswer(direction === 'right')
    })
  }

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onPanResponderMove: (_, g) => {
      dragX.setValue(g.dx)
      dragY.setValue(Math.max(-100, Math.min(100, g.dy * 0.4)))
    },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) <= SWIPE_THRESHOLD) {
        resetDrag()
        return
      }
      handleSwipe(g.dx > 0 ? 'right' : 'left')
    },
    onPanResponderTerminate: resetDrag,
  }), [dragX, dragY])

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] })
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] })
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [1, 1, 0, 0] })
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 0.45, 0.55, 1], outputRange: [0, 0, 1, 1] })
  const swipeRotate = dragX.interpolate({
    inputRange: [-CARD_W, 0, CARD_W],
    outputRange: ['-10deg', '0deg', '10deg'],
  })
  const leftOpacity = dragX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -16, 0], outputRange: [1, 0.2, 0], extrapolate: 'clamp',
  })
  const rightOpacity = dragX.interpolate({
    inputRange: [0, 16, SWIPE_THRESHOLD], outputRange: [0, 0.2, 1], extrapolate: 'clamp',
  })

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    )
  }

  if (finished || !word) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="trophy" size={56} color={colors.accent} />
          <Text style={styles.doneTitle}>Tur tamamlandı!</Text>
          <Text style={styles.doneSub}>
            {gotIt.length} doğru · {stillLearning.length} hâlâ öğreniliyor
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => router.replace(`/sets/${set?.id}`)}
            >
              <Text style={styles.btnSecondaryText}>Sete dön</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                const items = set ? shuffle(set.terms) : []
                setQueue(items)
                setStillLearning([])
                setGotIt([])
                setCurrent(0)
                setFinished(false)
              }}
            >
              <Text style={styles.btnPrimaryText}>Yeniden başla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const totalThisRound = queue.length
  const remaining = totalThisRound - current
  const progressPercent = totalThisRound > 0 ? Math.round((current / totalThisRound) * 100) : 0

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topTitle} numberOfLines={1}>{set?.name}</Text>
          <Text style={styles.topSub}>Flashcards</Text>
        </View>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statChip, { borderColor: 'rgba(248,113,113,0.34)' }]}>
          <Ionicons name="refresh-circle-outline" size={13} color="#f87171" />
          <Text style={[styles.statChipText, { color: '#f87171' }]}>{stillLearning.length}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
        <View style={[styles.statChip, { borderColor: 'rgba(74,222,128,0.34)' }]}>
          <Ionicons name="checkmark-circle-outline" size={13} color="#4ade80" />
          <Text style={[styles.statChipText, { color: '#4ade80' }]}>{gotIt.length}</Text>
        </View>
      </View>

      <View style={styles.cardArea}>
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            transform: [
              { translateX: Animated.add(slideAnim, dragX) },
              { translateY: dragY },
              { rotate: swipeRotate },
            ],
          }}
        >
          <Pressable onPress={flip} style={styles.cardWrapper}>
            {/* Front */}
            <Animated.View style={[
              styles.card, styles.cardFront,
              { opacity: frontOpacity, transform: [{ rotateY: frontRotate }] },
            ]}>
              <Animated.View style={[styles.swipeBadge, styles.swipeBadgeLeft, { opacity: leftOpacity }]}>
                <Text style={[styles.swipeBadgeText, { color: '#f87171' }]}>HÂLÂ ÖĞRENİYORUM</Text>
              </Animated.View>
              <Animated.View style={[styles.swipeBadge, styles.swipeBadgeRight, { opacity: rightOpacity }]}>
                <Text style={[styles.swipeBadgeText, { color: '#4ade80' }]}>BİLİYORUM</Text>
              </Animated.View>

              <View style={styles.cardTop}>
                <View style={styles.pillDark}>
                  <Text style={styles.pillDarkText}>TERM</Text>
                </View>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); speak(word.word) }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="volume-medium-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.cardWord}>{word.word}</Text>
              {word.ipa ? <Text style={styles.ipa}>/{word.ipa}/</Text> : null}

              <View style={styles.flipHint}>
                <Ionicons name="hand-left-outline" size={14} color={colors.accent} />
                <Text style={styles.flipHintText}>Dokun → tanımı gör</Text>
              </View>
            </Animated.View>

            {/* Back */}
            <Animated.View style={[
              styles.card, styles.cardBack,
              { opacity: backOpacity, transform: [{ rotateY: backRotate }] },
            ]}>
              <View style={styles.cardTop}>
                <View style={[styles.pillDark, { backgroundColor: 'rgba(96,165,250,0.16)' }]}>
                  <Text style={[styles.pillDarkText, { color: '#60a5fa' }]}>DEFINITION</Text>
                </View>
              </View>
              <Text style={styles.cardTranslation}>{word.translation || '—'}</Text>
              {word.context ? (
                <View style={styles.contextBox}>
                  <Text style={styles.contextText} numberOfLines={3}>{word.context}</Text>
                </View>
              ) : null}
            </Animated.View>
          </Pressable>
        </Animated.View>
      </View>

      {flipped ? (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionLeft]}
            onPress={() => handleAnswer(false)}
            activeOpacity={0.86}
          >
            <Ionicons name="close-circle-outline" size={20} color="#f87171" />
            <Text style={[styles.actionText, { color: '#f87171' }]}>Hâlâ öğreniyorum</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionRight]}
            onPress={() => handleAnswer(true)}
            activeOpacity={0.86}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#4ade80" />
            <Text style={[styles.actionText, { color: '#4ade80' }]}>Biliyorum</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.hintText}>Sağa kaydır = biliyorum · Sola kaydır = öğreniyorum</Text>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  topTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  topSub: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 2 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginBottom: 18,
  },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    minWidth: 50, justifyContent: 'center',
  },
  statChipText: { fontSize: 12, fontWeight: '800' },
  progressTrack: { flex: 1, height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },

  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  cardWrapper: { width: CARD_W, height: CARD_H },
  card: {
    width: '100%', height: '100%', borderRadius: 24,
    padding: 26, position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
    backfaceVisibility: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45, shadowRadius: 22, elevation: 12,
  },
  cardFront: { backgroundColor: '#fbfbfd', borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' },
  cardBack: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: 'rgba(96,165,250,0.32)' },

  cardTop: {
    position: 'absolute', top: 18, left: 18, right: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  pillDark: {
    backgroundColor: 'rgba(15,23,42,0.06)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  pillDarkText: { color: '#475569', fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },

  cardWord: { fontSize: 40, fontWeight: '900', color: '#111827', textAlign: 'center', letterSpacing: -1 },
  ipa: { color: '#64748b', fontSize: 14, marginTop: 6 },
  cardTranslation: { fontSize: 30, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginBottom: 14, letterSpacing: -0.5 },
  contextBox: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', width: '100%',
  },
  contextText: { color: '#475569', fontSize: 12, lineHeight: 18, textAlign: 'center' },

  flipHint: { position: 'absolute', bottom: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  flipHintText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  swipeBadge: {
    position: 'absolute', top: 22,
    borderWidth: 1.5, borderColor: '#94a3b8',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  swipeBadgeLeft: { left: 18, borderColor: '#f87171' },
  swipeBadgeRight: { right: 18, borderColor: '#4ade80' },
  swipeBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },

  actionRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8,
  },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, backgroundColor: colors.bgCard,
  },
  actionLeft: { borderColor: 'rgba(248,113,113,0.34)', backgroundColor: 'rgba(248,113,113,0.10)' },
  actionRight: { borderColor: 'rgba(74,222,128,0.34)', backgroundColor: 'rgba(74,222,128,0.10)' },
  actionText: { fontSize: 13, fontWeight: '800' },

  hintText: {
    color: colors.textMuted, fontSize: 11, fontWeight: '600',
    textAlign: 'center', paddingBottom: 24, paddingTop: 8,
  },

  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 8 },
  doneSub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  btnPrimary: {
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
  },
  btnPrimaryText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  btnSecondary: {
    backgroundColor: colors.bgCard, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border,
  },
  btnSecondaryText: { color: colors.text, fontWeight: '700', fontSize: 14 },
})
