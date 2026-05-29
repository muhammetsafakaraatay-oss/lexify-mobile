import { useEffect } from 'react'
import { Alert } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from '../lib/supabase'
import { SubscriptionProvider } from '../contexts/SubscriptionContext'
import { mergeGuestDataIntoAccount } from '../lib/data'

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const { words, history } = await mergeGuestDataIntoAccount()
        const { disableGuestMode } = await import('../lib/guest')
        await disableGuestMode()
        router.replace('/(tabs)/dashboard')
        if (words > 0 || history > 0) {
          const parts: string[] = []
          if (words > 0) parts.push(`${words} kelime`)
          if (history > 0) parts.push(`${history} okuma kaydı`)
          Alert.alert(
            'Veriler aktarıldı',
            `Misafir ${parts.join(' ve ')} hesabına eklendi. Artık tüm cihazlarında senkron.`,
          )
        }
        return
      }
      if (event === 'SIGNED_OUT') {
        router.replace('/auth/login')
      }
    })
    return () => authSub.unsubscribe()
  }, [router])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SubscriptionProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }} />
      </SubscriptionProvider>
    </GestureHandlerRootView>
  )
}
