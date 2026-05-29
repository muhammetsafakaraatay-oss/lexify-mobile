import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { isGuestMode } from '../../lib/guest'

const BOOT_TIMEOUT_MS = 2500

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(null)
      },
    )
  })
}

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function check() {
      const onboarded = await withTimeout(AsyncStorage.getItem('onboarding_done'), BOOT_TIMEOUT_MS)
      if (onboarded !== 'true') {
        if (cancelled) return
        router.replace('/onboarding')
        return
      }

      const sessionResult = await withTimeout(supabase.auth.getSession(), BOOT_TIMEOUT_MS)
      const session = sessionResult?.data?.session ?? null
      if (session) {
        if (cancelled) return
        router.replace('/(tabs)/dashboard')
        return
      }

      const guestMode = await withTimeout(isGuestMode(), BOOT_TIMEOUT_MS)
      if (guestMode) {
        if (cancelled) return
        router.replace('/(tabs)/dashboard')
        return
      }

      if (cancelled) return
      router.replace('/auth/login')
    }

    const hardFallback = setTimeout(() => {
      if (!cancelled) router.replace('/auth/login')
    }, BOOT_TIMEOUT_MS * 2)

    void check().finally(() => clearTimeout(hardFallback))

    return () => {
      cancelled = true
      clearTimeout(hardFallback)
    }
  }, [router])

  return (
    <View style={styles.splash}>
      <Text style={styles.logo}>Lexify</Text>
      <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 36, fontWeight: '800', color: colors.text, letterSpacing: -1 },
})
