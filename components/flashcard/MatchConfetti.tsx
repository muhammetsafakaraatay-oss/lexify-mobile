// Lexify · MatchConfetti
// Two flavors in one file:
//   <ConfettiBurst x y />   — particle pop from a point (used on correct match)
//   <FullScreenConfetti />  — falling pieces across the full screen (used on completion)
//
// Both are 100% reanimated v2 (no external confetti lib).

import React, { useEffect, useMemo, useRef } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated'

const PALETTE = ['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa']

// ────────────────────────────────────────────────────────────
// Particle burst (small)
// ────────────────────────────────────────────────────────────

type BurstProps = {
  x: number
  y: number
  count?: number
  onDone?: () => void
}

export function ConfettiBurst({ x, y, count = 8, onDone }: BurstProps) {
  const particles = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
      const distance = 40 + Math.random() * 40
      return {
        i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        color: PALETTE[i % PALETTE.length],
        size: 6 + Math.round(Math.random() * 4),
      }
    })
  }, [count])

  // Notify parent so it can unmount the burst after the animation.
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 600)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <View pointerEvents="none" style={[styles.burstWrap, { left: x, top: y }]}>
      {particles.map((p) => (
        <BurstParticle key={p.i} {...p} />
      ))}
    </View>
  )
}

function BurstParticle({ dx, dy, color, size }: {
  dx: number; dy: number; color: string; size: number
}) {
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const op = useSharedValue(1)
  const sc = useSharedValue(1)

  useEffect(() => {
    tx.value = withTiming(dx, { duration: 500, easing: Easing.out(Easing.cubic) })
    ty.value = withTiming(dy, { duration: 500, easing: Easing.out(Easing.cubic) })
    op.value = withTiming(0, { duration: 500 })
    sc.value = withTiming(0.3, { duration: 500 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value } as any,
      { translateY: ty.value } as any,
      { scale: sc.value } as any,
    ],
    opacity: op.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  )
}

// ────────────────────────────────────────────────────────────
// Full-screen confetti (completion)
// ────────────────────────────────────────────────────────────

type FullProps = {
  count?: number
}

export function FullScreenConfetti({ count = 50 }: FullProps) {
  const { width, height } = Dimensions.get('window')

  // Memoize confetti seeds so re-renders don't reshuffle.
  const seeds = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => ({
      i,
      x: Math.random() * width,
      delay: Math.round(Math.random() * 800),
      duration: 2200 + Math.round(Math.random() * 1800),
      sway: 8 + Math.random() * 18,
      size: 6 + Math.round(Math.random() * 6),
      rotateSpeed: 800 + Math.round(Math.random() * 1400),
      color: PALETTE[i % PALETTE.length],
      shape: (Math.random() < 0.5 ? 'rect' : 'dot') as 'rect' | 'dot',
    }))
  }, [count, width])

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {seeds.map((s) => (
        <ConfettiPiece key={s.i} seed={s} screenHeight={height} />
      ))}
    </View>
  )
}

function ConfettiPiece({
  seed, screenHeight,
}: {
  seed: {
    x: number; delay: number; duration: number; sway: number;
    size: number; rotateSpeed: number; color: string; shape: 'rect' | 'dot';
  }
  screenHeight: number
}) {
  const ty = useSharedValue(-40)
  const sway = useSharedValue(0)
  const rot = useSharedValue(0)
  const op = useSharedValue(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    op.value = withDelay(seed.delay, withTiming(1, { duration: 220 }))
    ty.value = withDelay(seed.delay, withTiming(screenHeight + 60, {
      duration: seed.duration,
      easing: Easing.in(Easing.quad),
    }))
    sway.value = withDelay(
      seed.delay,
      withRepeat(
        withSequence(
          withTiming(seed.sway, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(-seed.sway, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    )
    rot.value = withRepeat(
      withTiming(360, { duration: seed.rotateSpeed, easing: Easing.linear }),
      -1,
      false,
    )

    return () => {
      cancelAnimation(ty)
      cancelAnimation(sway)
      cancelAnimation(rot)
      cancelAnimation(op)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: sway.value } as any,
      { translateY: ty.value } as any,
      { rotate: `${rot.value}deg` } as any,
    ],
    opacity: op.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: seed.x,
          width: seed.size,
          height: seed.shape === 'rect' ? seed.size * 1.5 : seed.size,
          borderRadius: seed.shape === 'dot' ? seed.size / 2 : 2,
          backgroundColor: seed.color,
        },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  burstWrap: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
})
