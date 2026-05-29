// Lexify · Match mode sound manager (expo-av)
// Preloads small SFX assets and exposes a tiny API: play('correct' | 'wrong' | 'complete' | 'tick' | 'select')
// Respects a global "isSoundEnabled" flag, falls back silently on web/error, and unloads on unmount.

import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { Audio } from 'expo-av'

export type MatchSfx = 'correct' | 'wrong' | 'complete' | 'tick' | 'select'

// Asset map — kept as inline requires so Metro can resolve them at bundle time.
// (require() in RN is static; cannot be dynamic.)
const SFX_FILES: Record<MatchSfx, number> = {
  correct: require('../assets/sounds/match_correct.mp3'),
  wrong: require('../assets/sounds/match_wrong.mp3'),
  complete: require('../assets/sounds/match_complete.mp3'),
  tick: require('../assets/sounds/match_tick.mp3'),
  select: require('../assets/sounds/card_select.mp3'),
}

export type UseMatchSoundOptions = {
  enabled?: boolean
}

export function useMatchSound(opts: UseMatchSoundOptions = {}) {
  const enabled = opts.enabled !== false // default ON
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const soundsRef = useRef<Partial<Record<MatchSfx, Audio.Sound>>>({})
  const mountedRef = useRef(true)

  // Preload on mount
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    ;(async () => {
      try {
        // Allow playback even in iOS silent mode for game SFX.
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        }).catch(() => {})

        const entries = Object.entries(SFX_FILES) as [MatchSfx, number][]
        for (const [key, mod] of entries) {
          if (cancelled) return
          try {
            const { sound } = await Audio.Sound.createAsync(
              mod,
              { shouldPlay: false, volume: key === 'tick' ? 0.35 : 0.8 },
            )
            if (cancelled) {
              await sound.unloadAsync().catch(() => {})
              return
            }
            soundsRef.current[key] = sound
          } catch (e) {
            // One missing/corrupt asset shouldn't break the rest.
            console.warn(`[useMatchSound] failed to load ${key}:`, (e as any)?.message ?? e)
          }
        }
      } catch (e) {
        console.warn('[useMatchSound] init failed:', (e as any)?.message ?? e)
      }
    })()

    return () => {
      cancelled = true
      mountedRef.current = false
      const map = soundsRef.current
      soundsRef.current = {}
      ;(async () => {
        for (const k of Object.keys(map) as MatchSfx[]) {
          const s = map[k]
          if (!s) continue
          try {
            await s.stopAsync().catch(() => {})
            await s.unloadAsync().catch(() => {})
          } catch {
            /* ignore */
          }
        }
      })()
    }
  }, [])

  const play = useCallback(async (which: MatchSfx) => {
    if (!enabledRef.current) return
    const s = soundsRef.current[which]
    if (!s) return
    try {
      // Rewind first so rapid taps re-trigger from the start.
      await s.setPositionAsync(0).catch(() => {})
      await s.playAsync()
    } catch (e) {
      // Some platforms (web in particular) can intermittently reject playback before
      // user interaction; we silently ignore.
      if (Platform.OS !== 'web') {
        console.warn('[useMatchSound] play failed:', (e as any)?.message ?? e)
      }
    }
  }, [])

  const stopAll = useCallback(async () => {
    const map = soundsRef.current
    for (const k of Object.keys(map) as MatchSfx[]) {
      const s = map[k]
      if (!s) continue
      try {
        await s.stopAsync()
      } catch {
        /* ignore */
      }
    }
  }, [])

  return { play, stopAll }
}
