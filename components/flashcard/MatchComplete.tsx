// Lexify · MatchComplete
// End-of-game screen: confetti, animated score, stats, performance note, CTAs.

import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { FullScreenConfetti } from './MatchConfetti'

type Props = {
  score: number
  durationSeconds: number
  correctCount: number
  wrongCount: number
  maxStreak: number
  totalSeconds: number
  timeUp?: boolean
  onRetry: () => void
  onExit: () => void
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r}s`
  return `${m}d ${r}s`
}

function performanceNote(wrong: number, timeUp: boolean | undefined): string {
  if (timeUp) return 'Süre doldu — bir dahaki sefere daha hızlı dene!'
  if (wrong === 0) return 'Mükemmel! Tüm eşleşmeler doğru!'
  if (wrong <= 2) return 'Çok iyi! Neredeyse mükemmeldi!'
  return 'İyi iş! Biraz daha pratik yapabilirsin.'
}

function starCount(wrong: number, correct: number, timeUp: boolean | undefined): 0 | 1 | 2 | 3 {
  if (timeUp && correct === 0) return 0
  if (timeUp) return 1
  if (wrong === 0) return 3
  if (wrong <= 2) return 2
  return 1
}

export default function MatchComplete({
  score, durationSeconds, correctCount, wrongCount, maxStreak,
  totalSeconds, timeUp, onRetry, onExit,
}: Props) {
  const [displayedScore, setDisplayedScore] = useState(0)

  // Counter animation: 0 → score over 800ms
  useEffect(() => {
    const start = Date.now()
    const duration = 800
    const from = 0
    const to = Math.max(0, Math.round(score))
    let raf: number | null = null
    const tick = () => {
      const elapsed = Date.now() - start
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setDisplayedScore(Math.round(from + (to - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick) as unknown as number
    }
    raf = requestAnimationFrame(tick) as unknown as number
    return () => { if (raf) cancelAnimationFrame(raf as unknown as number) }
  }, [score])

  // Card entrance
  const cardScale = useSharedValue(0.8)
  const cardOpacity = useSharedValue(0)
  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 14, stiffness: 160 })
    cardOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value } as any],
    opacity: cardOpacity.value,
  }))

  const stars = starCount(wrongCount, correctCount, timeUp)
  const note = performanceNote(wrongCount, timeUp)

  return (
    <View style={styles.container}>
      {!timeUp ? <FullScreenConfetti count={48} /> : null}

      <View style={styles.center}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.title}>{timeUp ? 'Süre Doldu' : 'Harika! 🎉'}</Text>

          <View style={styles.starsRow}>
            {[0, 1, 2].map((i) => (
              <StarBadge key={i} delay={300 + i * 150} filled={i < stars} />
            ))}
          </View>

          <Text style={styles.scoreLabel}>SKOR</Text>
          <Text style={styles.scoreBig}>{displayedScore}</Text>

          <View style={styles.statsGrid}>
            <Stat icon="timer-outline" label="Süre" value={fmtTime(Math.max(0, Math.round(durationSeconds)))} />
            <Stat icon="checkmark-circle" label="Doğru" value={String(correctCount)} valueColor="#4ade80" />
            <Stat icon="close-circle" label="Yanlış" value={String(wrongCount)} valueColor="#f87171" />
            <Stat icon="flame" label="En uzun seri" value={String(maxStreak)} valueColor="#fb923c" />
          </View>

          <Text style={styles.note}>{note}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={onRetry} style={styles.primaryBtn} activeOpacity={0.85}>
              <Ionicons name="reload" size={16} color={colors.bg} />
              <Text style={styles.primaryBtnText}>Tekrar Oyna</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onExit} style={styles.secondaryBtn} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Devam Et</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </View>
  )
}

function StarBadge({ filled, delay }: { filled: boolean; delay: number }) {
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.6)
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 280 }))
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 200 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay])
  const s = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value } as any],
  }))
  return (
    <Animated.View style={s}>
      <Ionicons
        name={filled ? 'star' : 'star-outline'}
        size={28}
        color={filled ? colors.accent : colors.textMuted}
      />
    </Animated.View>
  )
}

function Stat({ icon, label, value, valueColor }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20,
  },
  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border, borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  scoreLabel: {
    color: colors.textMuted, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.2, marginTop: 8,
  },
  scoreBig: {
    color: colors.accent, fontSize: 56, fontWeight: '900',
    fontVariant: ['tabular-nums'], marginTop: -2,
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    marginTop: 8, marginBottom: 4, width: '100%', justifyContent: 'center',
  },
  statBox: {
    width: '47%', backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, alignItems: 'flex-start', gap: 2,
  },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 2, fontVariant: ['tabular-nums'] },
  note: {
    color: colors.textDim, fontSize: 13, lineHeight: 19,
    textAlign: 'center', marginTop: 8, paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'stretch', width: '100%',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.accent, paddingVertical: 13, borderRadius: 999,
  },
  primaryBtnText: { color: colors.bg, fontWeight: '900', fontSize: 14 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg,
  },
  secondaryBtnText: { color: colors.text, fontWeight: '900', fontSize: 14 },
})
