// Lexify · MatchCountdown
// 3 … 2 … 1 … Başla! before the game starts.
// Each number animates: scale 1.5 → 1.0 + opacity 1 → 0.3 (spring), 800ms per step.

import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { colors } from '../../lib/theme'

type Props = {
  onDone: () => void
  // Optional: play a tick at each step (host wires up sound).
  onStep?: (step: 3 | 2 | 1 | 0) => void
}

const STEP_MS = 800

export default function MatchCountdown({ onDone, onStep }: Props) {
  const [step, setStep] = useState<3 | 2 | 1 | 0>(3)
  const finishedRef = useRef(false)

  const scale = useSharedValue(1.5)
  const opacity = useSharedValue(1)

  useEffect(() => {
    // Drive timed transitions in JS (UI thread handles the visual animation per step).
    const timers: ReturnType<typeof setTimeout>[] = []
    onStep?.(3)
    runStepAnimation()
    timers.push(setTimeout(() => { setStep(2); onStep?.(2); runStepAnimation() }, STEP_MS))
    timers.push(setTimeout(() => { setStep(1); onStep?.(1); runStepAnimation() }, STEP_MS * 2))
    timers.push(setTimeout(() => { setStep(0); onStep?.(0); runStepAnimation() }, STEP_MS * 3))
    timers.push(setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true
        onDone()
      }
    }, STEP_MS * 4))
    return () => { timers.forEach(clearTimeout) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function runStepAnimation() {
    scale.value = 1.5
    opacity.value = 1
    scale.value = withSpring(1.0, { damping: 12, stiffness: 130 })
    opacity.value = withDelay(120, withTiming(0.3, { duration: 600, easing: Easing.out(Easing.cubic) }))
  }

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value } as any],
    opacity: opacity.value,
  }))

  const label = step === 0 ? 'Başla!' : String(step)

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.bubble, step === 0 && styles.bubbleGo, animStyle]}>
        <Text style={[styles.num, step === 0 && styles.numGo]}>{label}</Text>
      </Animated.View>
      <Text style={styles.hint}>Eşleştirme başlıyor</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: colors.bg,
  },
  bubble: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accentDim,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleGo: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  num: {
    color: colors.accent,
    fontSize: 72,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  numGo: {
    color: '#0b0b0b',
    fontSize: 40,
    letterSpacing: 0.4,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    letterSpacing: 0.6,
    fontWeight: '700',
  },
})
