import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Pressable, Dimensions, PanResponder, Animated as RNAnimated, Easing as RNEasing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, runOnJS, Easing,
} from 'react-native-reanimated'
import { colors } from '../../../../lib/theme'
import { speak } from '../../../../lib/speech'
import {
  listCards, updateCardStatus, getDeck,
  type FlashcardCard, type CardStatus,
} from '../../../../lib/flashcards'

type StudyMode = 'flip' | 'review'

const { width: SCREEN_W } = Dimensions.get('window')
const SWIPE_THRESHOLD = 110

export default function StudyScreen() {
  const router = useRouter()
  const { deckId, mode: modeParam } = useLocalSearchParams<{ deckId: string; mode?: string }>()
  const mode: StudyMode = modeParam === 'review' ? 'review' : 'flip'

  const [title, setTitle] = useState('')
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [order, setOrder] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionDone, setSessionDone] = useState(false)
  const [counts, setCounts] = useState({ known: 0, unknown: 0 })

  const rot = useSharedValue(0)
  const pan = useRef(new RNAnimated.ValueXY({ x: 0, y: 0 })).current

  const load = useCallback(async () => {
    if (!deckId) return
    setLoading(true)
    setError(null)
    try {
      const [d, list] = await Promise.all([getDeck(deckId), listCards(deckId)])
      setTitle(d?.title ?? '')
      const shuffled = shuffle(list)
      setCards(shuffled)
      setOrder(shuffled.map((c) => c.id))
      setIdx(0)
      setFlipped(false)
      setSessionDone(shuffled.length === 0)
      setCounts({ known: 0, unknown: 0 })
      rot.value = 0
      pan.setValue({ x: 0, y: 0 })
    } catch (e: any) {
      setError(e?.message || 'Yükleme başarısız')
    } finally {
      setLoading(false)
    }
  }, [deckId, pan, rot])

  useEffect(() => { void load() }, [load])

  const cardMap = useMemo(() => {
    const m = new Map<string, FlashcardCard>()
    for (const c of cards) m.set(c.id, c)
    return m
  }, [cards])

  const current = order[idx] ? cardMap.get(order[idx]) ?? null : null

  const frontStyle = useAnimatedStyle(() => {
    const rotateY = `${rot.value}deg`
    const opacity = interpolate(rot.value, [0, 89, 90], [1, 1, 0])
    return {
      transform: [{ perspective: 1000 } as any, { rotateY } as any],
      opacity,
    }
  })
  const backStyle = useAnimatedStyle(() => {
    const rotateY = `${rot.value - 180}deg`
    const opacity = interpolate(rot.value, [90, 91, 180], [0, 1, 1])
    return {
      transform: [{ perspective: 1000 } as any, { rotateY } as any],
      opacity,
    }
  })

  function toggleFlip() {
    const next = !flipped
    setFlipped(next)
    rot.value = withTiming(next ? 180 : 0, { duration: 380, easing: Easing.inOut(Easing.cubic) })
  }

  function resetFlip(immediate = false) {
    setFlipped(false)
    if (immediate) {
      rot.value = 0
    } else {
      rot.value = withTiming(0, { duration: 200 })
    }
  }

  const advance = useCallback((status: CardStatus) => {
    if (!current) return
    const id = current.id

    if (status === 'known') setCounts((c) => ({ ...c, known: c.known + 1 }))
    else if (status === 'unknown') setCounts((c) => ({ ...c, unknown: c.unknown + 1 }))

    void (async () => {
      try {
        await updateCardStatus(id, status)
      } catch {
        // silent
      }
    })()

    const nextIdx = idx + 1
    if (nextIdx >= order.length) {
      setSessionDone(true)
    } else {
      setIdx(nextIdx)
      resetFlip(true)
    }
    pan.setValue({ x: 0, y: 0 })
  }, [current, idx, order.length, pan])

  function animateSwipe(toX: number, status: CardStatus) {
    RNAnimated.timing(pan, {
      toValue: { x: toX, y: 0 },
      duration: 260,
      useNativeDriver: true,
      easing: RNEasing.out(RNEasing.cubic),
    }).start(() => {
      advance(status)
    })
  }

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_e, g) => {
      pan.setValue({ x: g.dx, y: g.dy * 0.2 })
    },
    onPanResponderRelease: (_e, g) => {
      if (g.dx > SWIPE_THRESHOLD) {
        animateSwipe(SCREEN_W + 60, 'known')
      } else if (g.dx < -SWIPE_THRESHOLD) {
        animateSwipe(-SCREEN_W - 60, 'unknown')
      } else {
        RNAnimated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
          bounciness: 6,
        }).start()
      }
    },
    onPanResponderTerminate: () => {
      pan.setValue({ x: 0, y: 0 })
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [order, idx])

  const tiltDeg = pan.x.interpolate({
    inputRange: [-SCREEN_W, 0, SCREEN_W],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  })
  const tintRight = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  })
  const tintLeft = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  function restart() {
    const shuffled = shuffle(cards)
    setOrder(shuffled.map((c) => c.id))
    setIdx(0)
    setSessionDone(false)
    setCounts({ known: 0, unknown: 0 })
    resetFlip(true)
    pan.setValue({ x: 0, y: 0 })
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    )
  }
  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={28} color="#f87171" />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }
  if (cards.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="albums-outline" size={36} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Bu destede kart yok</Text>
          <Text style={styles.emptyDesc}>Önce Düzenle bölümünden kart ekle.</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.topSub}>
            {mode === 'flip' ? 'Flip Mode' : 'Review Mode'}
          </Text>
        </View>
        <TouchableOpacity onPress={restart} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="shuffle-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((idx + (sessionDone ? 1 : 0)) / order.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {sessionDone ? order.length : idx + 1}/{order.length}
        </Text>
      </View>

      {sessionDone ? (
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="trophy" size={40} color={colors.accent} />
          </View>
          <Text style={styles.doneTitle}>Tur tamam!</Text>
          <Text style={styles.doneDesc}>
            {counts.known} biliyorum · {counts.unknown} tekrar gerekli
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity onPress={restart} style={styles.primaryBtn} activeOpacity={0.85}>
              <Ionicons name="reload" size={16} color={colors.bg} />
              <Text style={styles.primaryBtnText}>Tekrar başla</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.secondaryBtn} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Bitir</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.cardArea}>
          <RNAnimated.View
            pointerEvents="none"
            style={[styles.tintLayer, { backgroundColor: '#4ade8033', opacity: tintRight }]}
          >
            <View style={[styles.tintBadge, { borderColor: '#4ade80' }]}>
              <Ionicons name="checkmark" size={28} color="#4ade80" />
              <Text style={[styles.tintBadgeText, { color: '#4ade80' }]}>BİLİYORUM</Text>
            </View>
          </RNAnimated.View>
          <RNAnimated.View
            pointerEvents="none"
            style={[styles.tintLayer, { backgroundColor: '#f8717133', opacity: tintLeft }]}
          >
            <View style={[styles.tintBadge, { borderColor: '#f87171' }]}>
              <Ionicons name="close" size={28} color="#f87171" />
              <Text style={[styles.tintBadgeText, { color: '#f87171' }]}>BİLMİYORUM</Text>
            </View>
          </RNAnimated.View>

          <RNAnimated.View
            style={[
              styles.cardOuter,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                  { rotate: tiltDeg },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Pressable onPress={toggleFlip} style={{ flex: 1 }}>
              <Animated.View style={[styles.cardFace, frontStyle]}>
                <Text style={styles.cardLabel}>ÖN YÜZ</Text>
                <Text style={styles.cardText}>{current?.front ?? ''}</Text>
                <TouchableOpacity
                  style={styles.speakerBtn}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  onPress={(e) => {
                    e.stopPropagation?.()
                    if (current?.front) speak(current.front, { language: 'en-US' })
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high" size={22} color={colors.accent} />
                </TouchableOpacity>
                <Text style={styles.hintText}>Kartı çevirmek için dokun</Text>
              </Animated.View>
              <Animated.View style={[styles.cardFace, styles.cardBack, backStyle]}>
                <Text style={styles.cardLabel}>ARKA YÜZ</Text>
                <Text style={styles.cardText}>{current?.back ?? ''}</Text>
                <TouchableOpacity
                  style={styles.speakerBtn}
                  hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                  onPress={(e) => {
                    e.stopPropagation?.()
                    if (current?.back) speak(current.back, { language: 'tr-TR' })
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="volume-high" size={22} color={colors.accent} />
                </TouchableOpacity>
                <Text style={styles.hintText}>Tekrar dokun</Text>
              </Animated.View>
            </Pressable>
          </RNAnimated.View>
        </View>
      )}

      {!sessionDone ? (
        <View style={styles.bottomBar}>
          {mode === 'review' ? (
            <>
              <TouchableOpacity
                style={[styles.respBtn, styles.respBtnRed]}
                activeOpacity={0.85}
                onPress={() => animateSwipe(-SCREEN_W - 60, 'unknown')}
              >
                <Ionicons name="close" size={20} color="#f87171" />
                <Text style={[styles.respBtnText, { color: '#f87171' }]}>Bilmiyorum</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.respBtn, styles.respBtnGreen]}
                activeOpacity={0.85}
                onPress={() => animateSwipe(SCREEN_W + 60, 'known')}
              >
                <Ionicons name="checkmark" size={20} color="#4ade80" />
                <Text style={[styles.respBtnText, { color: '#4ade80' }]}>Biliyorum</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.respBtn, styles.respBtnRed]}
                activeOpacity={0.85}
                onPress={() => animateSwipe(-SCREEN_W - 60, 'unknown')}
              >
                <Ionicons name="arrow-back" size={18} color="#f87171" />
                <Text style={[styles.respBtnText, { color: '#f87171' }]}>Tekrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.respBtn, { borderColor: colors.border }]}
                activeOpacity={0.85}
                onPress={toggleFlip}
              >
                <Ionicons name="sync" size={18} color={colors.text} />
                <Text style={[styles.respBtnText, { color: colors.text }]}>Çevir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.respBtn, styles.respBtnGreen]}
                activeOpacity={0.85}
                onPress={() => animateSwipe(SCREEN_W + 60, 'known')}
              >
                <Ionicons name="arrow-forward" size={18} color="#4ade80" />
                <Text style={[styles.respBtnText, { color: '#4ade80' }]}>Geçtim</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 8,
  },
  topTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  topSub: { color: colors.textMuted, fontSize: 11, fontWeight: '700', marginTop: 1, letterSpacing: 0.6 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  errText: { color: colors.text, fontSize: 14, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  retryBtnText: { color: colors.accent, fontWeight: '800' },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  emptyDesc: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },

  progressWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginTop: 4, marginBottom: 14,
  },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  progressText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },

  cardArea: { flex: 1, paddingHorizontal: 20, position: 'relative' },
  cardOuter: {
    position: 'absolute', top: 0, left: 20, right: 20, bottom: 0,
  },
  cardFace: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.bgCard,
    borderRadius: 22, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    padding: 24, backfaceVisibility: 'hidden',
  },
  cardBack: { backgroundColor: '#101316', borderColor: '#1b1f24' },
  cardLabel: {
    position: 'absolute', top: 16, left: 18,
    color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1,
  },
  cardText: {
    color: colors.text, fontSize: 28, fontWeight: '800',
    textAlign: 'center', lineHeight: 36,
  },
  hintText: {
    position: 'absolute', bottom: 16,
    color: colors.textMuted, fontSize: 11, fontWeight: '700',
  },
  speakerBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.accentDim,
    borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  tintLayer: {
    position: 'absolute', top: 0, left: 20, right: 20, bottom: 0,
    borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  tintBadge: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  tintBadgeText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },

  bottomBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: colors.bg,
  },
  respBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.bgCard, borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 13,
  },
  respBtnGreen: { borderColor: '#4ade80' },
  respBtnRed: { borderColor: '#f87171' },
  respBtnText: { fontSize: 13, fontWeight: '800' },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  doneIcon: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  doneTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  doneDesc: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999,
  },
  primaryBtnText: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  secondaryBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCard,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '800', fontSize: 14 },
})

void runOnJS
