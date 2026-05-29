// Lexify · MatchCard
// One tile in the Match grid. Animates selection, correct-vanish, and wrong-shake
// using react-native-reanimated v2 (useSharedValue + useAnimatedStyle).

import React, { useEffect } from 'react'
import { Platform, StyleSheet, Pressable, View, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { colors } from '../../lib/theme'

export type MatchCardState = 'idle' | 'selected' | 'correct' | 'wrong'

type Props = {
  text: string
  state: MatchCardState
  disabled?: boolean
  onPress: () => void
  // Delay (ms) for entrance stagger
  entranceDelay?: number
}

const SHAKE_STEP = 40

export default function MatchCard({
  text, state, disabled, onPress, entranceDelay = 0,
}: Props) {
  // Shared values
  const scale = useSharedValue(0.94)
  const opacity = useSharedValue(0)
  const tx = useSharedValue(0)         // shake offset
  const ty = useSharedValue(-30)       // entrance translateY
  const bg = useSharedValue(0)         // 0=idle, 1=selected, 2=correct, 3=wrong

  // Entrance
  useEffect(() => {
    ty.value = withDelay(entranceDelay, withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }))
    opacity.value = withDelay(entranceDelay, withTiming(1, { duration: 280 }))
    scale.value = withDelay(entranceDelay, withSpring(1, { damping: 14, stiffness: 180 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to state changes
  useEffect(() => {
    if (state === 'selected') {
      bg.value = withTiming(1, { duration: 200 })
      scale.value = withSpring(1.05, { damping: 12, stiffness: 220 })
    } else if (state === 'correct') {
      bg.value = withTiming(2, { duration: 150 })
      // Pop and vanish
      scale.value = withSequence(
        withSpring(1.10, { damping: 12, stiffness: 240 }),
        withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic) }),
      )
      opacity.value = withDelay(100, withTiming(0, { duration: 300 }))
    } else if (state === 'wrong') {
      bg.value = withTiming(3, { duration: 150 })
      // Shake
      tx.value = withSequence(
        withTiming(-8, { duration: SHAKE_STEP }),
        withTiming(8, { duration: SHAKE_STEP }),
        withTiming(-6, { duration: SHAKE_STEP }),
        withTiming(6, { duration: SHAKE_STEP }),
        withTiming(-4, { duration: SHAKE_STEP }),
        withTiming(4, { duration: SHAKE_STEP }),
        withTiming(0, { duration: SHAKE_STEP }),
      )
      // Color returns to idle after the shake
      bg.value = withDelay(SHAKE_STEP * 7, withTiming(0, { duration: 200 }))
    } else {
      // idle
      bg.value = withTiming(0, { duration: 200 })
      scale.value = withSpring(1, { damping: 14, stiffness: 200 })
    }
  }, [state, bg, scale, tx, opacity])

  const animStyle = useAnimatedStyle(() => {
    // Interpolate background and border colors via JS-side conditional palette
    // (Reanimated 2 doesn't interpolate colors as smoothly across 4 stops in JS without runtime hint,
    // so we toggle stylesheet variants below and use SV for opacity/scale/translate only.)
    return {
      transform: [
        { translateY: ty.value } as any,
        { translateX: tx.value } as any,
        { scale: scale.value } as any,
      ],
      opacity: opacity.value,
    }
  })

  // Pick style class based on `state` (snappy enough at 200ms).
  const stateStyle =
    state === 'selected' ? styles.selected :
    state === 'correct' ? styles.correct :
    state === 'wrong' ? styles.wrong :
    styles.idle

  const textStyle =
    state === 'selected' ? styles.textSelected :
    state === 'correct' ? styles.textCorrect :
    state === 'wrong' ? styles.textWrong :
    styles.textIdle

  return (
    <Animated.View style={[styles.outer, animStyle]} pointerEvents={disabled ? 'none' : 'auto'}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        android_ripple={{ color: colors.accentDim, borderless: false }}
        style={({ pressed }) => [
          styles.tile,
          stateStyle,
          pressed && !disabled && state === 'idle' && styles.pressed,
        ]}
      >
        <View style={styles.textWrap}>
          <Text style={[styles.text, textStyle]} numberOfLines={4}>
            {text}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 2 },
  default: {},
})

const selectedShadow = Platform.select({
  ios: {
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 5 },
  default: {},
})

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  tile: {
    minHeight: 64,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    ...(shadow as object),
  },
  textWrap: {
    width: '100%',
    alignItems: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Variants
  idle: {
    backgroundColor: colors.bgCard,
    borderColor: colors.border,
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    ...(selectedShadow as object),
  },
  correct: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
  },
  wrong: {
    backgroundColor: '#1a0e0e',
    borderColor: '#FF4444',
  },

  pressed: {
    opacity: 0.85,
  },

  // Text colors per state
  textIdle: { color: colors.text },
  textSelected: { color: '#0b0b0b' },
  textCorrect: { color: '#062611' },
  textWrong: { color: '#fca5a5' },
})
