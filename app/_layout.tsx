import { useEffect } from 'react'
import { Alert } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { getCurrentUser } from '../lib/auth'
import { initializeRevenueCat, SubscriptionProvider } from '../lib/revenuecat'

try {
  initializeRevenueCat()
} catch (err: any) {
  Alert.alert('RevenueCat Unavailable', err?.message ?? 'Unknown error')
}

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) {
        router.replace('/(tabs)/dashboard')
      }
    })
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SubscriptionProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }} />
      </SubscriptionProvider>
    </GestureHandlerRootView>
  )
}
