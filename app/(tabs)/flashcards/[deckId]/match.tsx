// Lexify · Match (Eşleştirme) mode — Duolingo style
// Wires together: useMatchGame (logic) + useMatchSound (SFX) + speech (TTS)
// + MatchCard (tiles) + MatchConfetti (FX) + MatchCountdown (3-2-1) + MatchComplete.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolateColor,
} from 'react-native-reanimated'

import { colors } from '../../../../lib/theme'
import { speak } from '../../../../lib/speech'
import {
  getDeck, listRandomCards, recordMatchSession,
  NotSignedInError,
  type FlashcardCard,
} from '../../../../lib/flashcards'

import { useMatchGame, type MatchResult, type Tile } from '../../../../hooks/useMatchGame'
import { useMatchSound } from '../../../../hooks/useMatchSound'

import MatchCard, { type MatchCardState } from '../../../../components/flashcard/MatchCard'
import { ConfettiBurst } from '../../../../components/flashcard/MatchConfetti'
import MatchCountdown from '../../../../components/flashcard/MatchCountdown'
import MatchComplete from '../../../../components/flashcard/MatchComplete'

// Number of pairs per game.
const PAIRS = 6
const MIN_REQUIRED = 4

type Phase = 'loading' | 'error' | 'noauth' | 'countdown' | 'playing' | 'done' | 'timeup'

type Burst = { id: number; x: number; y: number }

type TileLayout = { x: number; y: number; w: number; h: number }

export default function MatchScreen() {
  const router = useRouter()
  const { deckId } = useLocalSearchParams<{ deckId: string }>()

  const [phase, setPhase] = useState<Phase>('loading')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<FlashcardCard[]>([])
  const [bursts, setBursts] = useState<Burst[]>([])
  const burstIdRef = useRef(0)

  // Tile layout cache for confetti positioning
  const layoutRef = useRef<Map<string, TileLayout>>(new Map())

  // Sound is on by default; could be wired to prefs later.
  const { play } = useMatchSound({ enabled: true })

  // Load deck + cards. Picks 6 random for the round.
  const load = useCallback(async () => {
    if (!deckId) return
    setPhase('loading')
    setError(null)
    try {
      const [d, picked] = await Promise.all([getDeck(deckId), listRandomCards(deckId, PAIRS)])
      setTitle(d?.title ?? 'Eşleştir')
      if (picked.length < MIN_REQUIRED) {
        setError(`Match için en az ${MIN_REQUIRED} kart gerekli. (Deste: ${picked.length})`)
        setPhase('error')
        return
      }
      setCards(picked)
      setPhase('countdown')
    } catch (e: any) {
      if (e instanceof NotSignedInError) {
        setPhase('noauth')
        return
      }
      setError(e?.message || 'Yükleme başarısız')
      setPhase('error')
    }
  }, [deckId])

  useEffect(() => { void load() }, [load])

  function emitBurstBetween(aKey: string, bKey: string) {
    const a = layoutRef.current.get(aKey)
    const b = layoutRef.current.get(bKey)
    if (!a && !b) return
    const cx = a && b ? (a.x + a.w / 2 + b.x + b.w / 2) / 2 : (a?.x ?? b!.x) + (a?.w ?? b!.w) / 2
    const cy = a && b ? (a.y + a.h / 2 + b.y + b.h / 2) / 2 : (a?.y ?? b!.y) + (a?.h ?? b!.h) / 2
    const id = ++burstIdRef.current
    setBursts((arr) => [...arr, { id, x: cx, y: cy }])
  }

  const handleResult = useCallback(async (r: MatchResult) => {
    if (r.kind === 'match') {
      await play('correct')
      emitBurstBetween(r.aKey, r.bKey)
      // Read back-side translation shortly after the correct sound finishes.
      setTimeout(() => {
        try { speak(r.cardBack, { language: 'tr-TR', rate: 0.95 }) } catch { /* ignore */ }
      }, 500)
    } else if (r.kind === 'wrong') {
      await play('wrong')
    }
  }, [play])

  const handleComplete = useCallback(async (o: { score: number; duration: number; correct: number; wrong: number; maxStreak: number }) => {
    await play('complete')
    setPhase('done')
    // Fire-and-forget persistence (no UI block).
    if (deckId) {
      void recordMatchSession({
        deck_id: deckId,
        score: o.score,
        duration_seconds: o.duration,
        correct_count: o.correct,
        wrong_count: o.wrong,
        max_streak: o.maxStreak,
      })
    }
  }, [deckId, play])

  const handleTimeUp = useCallback(async (o: { score: number; duration: number; correct: number; wrong: number; maxStreak: number }) => {
    await play('wrong')
    setPhase('timeup')
    if (deckId) {
      void recordMatchSession({
        deck_id: deckId,
        score: o.score,
        duration_seconds: o.duration,
        correct_count: o.correct,
        wrong_count: o.wrong,
        max_streak: o.maxStreak,
      })
    }
  }, [deckId, play])

  // Game hook
  const game = useMatchGame({
    cards,
    enabled: phase === 'playing',
    onResult: handleResult,
    onComplete: handleComplete,
    onTimeUp: handleTimeUp,
  })

  // Tick sound during final 10s. We monitor `remaining` and play on each whole second drop.
  const lastTickRef = useRef<number>(-1)
  useEffect(() => {
    if (phase !== 'playing') return
    if (game.remaining <= 10 && game.remaining > 0 && lastTickRef.current !== game.remaining) {
      lastTickRef.current = game.remaining
      void play('tick')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.remaining, phase])

  // Restart: ask the data layer for a fresh shuffle of cards too.
  const restart = useCallback(async () => {
    try {
      const picked = await listRandomCards(deckId!, PAIRS)
      if (picked.length < MIN_REQUIRED) {
        Alert.alert('Yetersiz kart', `Match için en az ${MIN_REQUIRED} kart gerekli.`)
        return
      }
      setCards(picked)
      setBursts([])
      layoutRef.current.clear()
      setPhase('countdown')
    } catch (e: any) {
      Alert.alert('Tekrar başlatılamadı', e?.message ?? 'Bilinmeyen hata')
    }
  }, [deckId])

  // ──────────────────────────────────────────────
  // Loading / Error / Auth states
  // ──────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={colors.accent} size="large" /></View>
      </SafeAreaView>
    )
  }
  if (phase === 'noauth') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBarSimple title={title} onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
          <Text style={styles.errText}>Giriş yapmadan Match modunu kullanamazsın.</Text>
          <TouchableOpacity onPress={() => router.push('/profile')} style={styles.primaryBtnSmall} activeOpacity={0.85}>
            <Text style={styles.primaryBtnSmallText}>Giriş yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }
  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBarSimple title={title} onBack={() => router.back()} />
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={28} color="#fb923c" />
          <Text style={styles.errText}>{error}</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.primaryBtnSmall} activeOpacity={0.85}>
            <Text style={styles.primaryBtnSmallText}>Geri dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ──────────────────────────────────────────────
  // Countdown
  // ──────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <MatchCountdown
          onDone={() => setPhase('playing')}
          onStep={(s) => {
            if (s === 3 || s === 2 || s === 1) void play('tick')
            if (s === 0) void play('select')
          }}
        />
      </SafeAreaView>
    )
  }

  // ──────────────────────────────────────────────
  // Complete / Time-up overlay
  // ──────────────────────────────────────────────
  if (phase === 'done' || phase === 'timeup') {
    const o = game.outcome
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <MatchComplete
          score={o.score}
          durationSeconds={o.duration}
          correctCount={o.correct}
          wrongCount={o.wrong}
          maxStreak={o.maxStreak}
          totalSeconds={game.totalSeconds}
          timeUp={phase === 'timeup'}
          onRetry={restart}
          onExit={() => router.back()}
        />
      </SafeAreaView>
    )
  }

  // ──────────────────────────────────────────────
  // Playing
  // ──────────────────────────────────────────────
  const progress = game.totalSeconds > 0 ? game.remaining / game.totalSeconds : 0
  const lowTime = game.remaining <= 10
  const veryLowTime = game.remaining <= 5

  function tileState(t: Tile, selectedKey: string | null): MatchCardState {
    if (t.matched) return 'correct'
    if (t.wrong) return 'wrong'
    if (selectedKey === t.key) return 'selected'
    return 'idle'
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <ProgressBar
            value={progress}
            lowTime={lowTime}
            veryLowTime={veryLowTime}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={styles.titleSmall} numberOfLines={1}>{title}</Text>
            <StreakChip streak={game.streak} />
          </View>
        </View>

        <TimerPill seconds={game.remaining} lowTime={lowTime} veryLowTime={veryLowTime} />
      </View>

      {/* Score row */}
      <View style={styles.scoreRow}>
        <View style={styles.scorePill}>
          <Ionicons name="star" size={13} color={colors.accent} />
          <Text style={styles.scoreText}>{game.score}</Text>
        </View>
        <Text style={styles.scoreSub}>
          {game.correct}/{PAIRS} eşleşme
        </Text>
      </View>

      {/* Grid */}
      <View
        style={styles.grid}
        onLayout={() => {/* root grid layout — children measure themselves */}}
      >
        <View style={styles.col}>
          {game.left.map((t, i) => (
            <View
              key={t.key}
              style={styles.cellOuter}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout
                // x/y here are relative to parent col; but for the burst we want grid-relative.
                // We'll combine with col offset captured below.
                layoutRef.current.set(t.key, {
                  x: x + COL_OFFSET_LEFT,
                  y: y + GRID_OFFSET_TOP + i * 0, // i unused but kept for clarity
                  w: width,
                  h: height,
                })
              }}
            >
              <MatchCard
                text={t.text}
                state={tileState(t, game.selectedLeft)}
                entranceDelay={i * 60}
                onPress={() => {
                  if (!t.matched && !t.wrong) {
                    void play('select')
                    // Speak the term when a front tile is selected (only if newly selected).
                    if (game.selectedLeft !== t.key) {
                      try { speak(t.text, { language: 'en-US', rate: 0.85 }) } catch { /* ignore */ }
                    }
                  }
                  game.tap(t)
                }}
              />
            </View>
          ))}
        </View>
        <View style={styles.col}>
          {game.right.map((t, i) => (
            <View
              key={t.key}
              style={styles.cellOuter}
              onLayout={(e) => {
                const { x, y, width, height } = e.nativeEvent.layout
                layoutRef.current.set(t.key, {
                  x: x + COL_OFFSET_RIGHT,
                  y: y + GRID_OFFSET_TOP,
                  w: width,
                  h: height,
                })
              }}
            >
              <MatchCard
                text={t.text}
                state={tileState(t, game.selectedRight)}
                entranceDelay={i * 60 + 30}
                onPress={() => {
                  if (!t.matched && !t.wrong) {
                    void play('select')
                  }
                  game.tap(t)
                }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Bursts */}
      {bursts.map((b) => (
        <ConfettiBurst
          key={b.id}
          x={b.x}
          y={b.y}
          onDone={() => setBursts((arr) => arr.filter((x) => x.id !== b.id))}
        />
      ))}
    </SafeAreaView>
  )
}

// Approx offsets used by burst positioning (grid is laid out with these paddings).
const GRID_OFFSET_TOP = 0
const COL_OFFSET_LEFT = 16
const COL_OFFSET_RIGHT = 16

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function TopBarSimple({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.topBar}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.titleSmall, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>{title}</Text>
      <View style={{ width: 26 }} />
    </View>
  )
}

function ProgressBar({ value, lowTime, veryLowTime }: { value: number; lowTime: boolean; veryLowTime: boolean }) {
  // Color phase: 0 = green, 1 = yellow, 2 = red
  const colorPhase = useSharedValue(0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    colorPhase.value = withTiming(veryLowTime ? 2 : lowTime ? 1 : 0, { duration: 350 })
  }, [lowTime, veryLowTime, colorPhase])

  useEffect(() => {
    if (lowTime) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 500, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      )
    } else {
      pulse.value = withTiming(1, { duration: 200 })
    }
  }, [lowTime, pulse])

  const widthStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, value)) * 100}%`,
    backgroundColor: interpolateColor(
      colorPhase.value,
      [0, 1, 2],
      ['#4ade80', '#facc15', '#f87171'],
    ),
  }))

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: pulse.value } as any],
  }))

  return (
    <Animated.View style={[styles.progressTrack, trackStyle]}>
      <Animated.View style={[styles.progressFill, widthStyle]} />
    </Animated.View>
  )
}

function TimerPill({ seconds, lowTime, veryLowTime }: {
  seconds: number; lowTime: boolean; veryLowTime: boolean
}) {
  const borderColor = veryLowTime ? '#f87171' : lowTime ? '#facc15' : colors.accent
  const txt = veryLowTime ? '#f87171' : lowTime ? '#facc15' : colors.accent
  return (
    <View style={[styles.timerPill, { borderColor }]}>
      <Ionicons name="timer-outline" size={13} color={txt} />
      <Text style={[styles.timerText, { color: txt }]}>{Math.max(0, Math.round(seconds))}s</Text>
    </View>
  )
}

function StreakChip({ streak }: { streak: number }) {
  const scale = useSharedValue(1)
  const prevRef = useRef(streak)

  useEffect(() => {
    if (streak < prevRef.current && prevRef.current >= 2) {
      // Streak broke → shake
      scale.value = withSequence(
        withTiming(0.85, { duration: 80 }),
        withTiming(1.05, { duration: 100 }),
        withTiming(1, { duration: 100 }),
      )
    } else if (streak >= 2) {
      scale.value = withSequence(
        withTiming(1.15, { duration: 120 }),
        withTiming(1, { duration: 140 }),
      )
    }
    prevRef.current = streak
  }, [streak, scale])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value } as any],
  }))

  if (streak < 2) {
    return (
      <Animated.View style={[styles.streakChipDim, animStyle]}>
        <Ionicons name="flame-outline" size={12} color={colors.textMuted} />
        <Text style={styles.streakTextDim}>{streak}x</Text>
      </Animated.View>
    )
  }
  return (
    <Animated.View style={[styles.streakChip, animStyle]}>
      <Ionicons name="flame" size={12} color="#fb923c" />
      <Text style={styles.streakText}>{streak}x</Text>
    </Animated.View>
  )
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 },
  errText: { color: colors.text, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 8,
  },
  titleSmall: { color: colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressFill: { height: '100%', borderRadius: 999 },

  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: colors.bgCard, borderWidth: 1.5,
  },
  timerText: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },

  scoreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 8,
  },
  scorePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  scoreText: { color: colors.accent, fontWeight: '900', fontSize: 13, fontVariant: ['tabular-nums'] },
  scoreSub: { color: colors.textMuted, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },

  streakChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(251,146,60,0.12)', borderWidth: 1, borderColor: '#fb923c',
  },
  streakText: { color: '#fb923c', fontWeight: '900', fontSize: 11 },
  streakChipDim: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border,
  },
  streakTextDim: { color: colors.textMuted, fontWeight: '800', fontSize: 11 },

  grid: {
    flex: 1, flexDirection: 'row',
    paddingHorizontal: 16, gap: 10,
    paddingBottom: 16,
  },
  col: { flex: 1, gap: 8 },
  cellOuter: { },

  primaryBtnSmall: {
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    marginTop: 6,
  },
  primaryBtnSmallText: { color: colors.bg, fontWeight: '900', fontSize: 14 },
})

// Silence "value declared but never used" warning for `useMemo` import on some configs.
// (Some Reanimated builds elide useMemo if unused — keep harmless reference.)
void useMemo
// Platform.OS branch retained inside MatchCard; this import keeps lint stable.
void Platform
