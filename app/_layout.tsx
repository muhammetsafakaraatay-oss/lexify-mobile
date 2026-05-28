import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { getCurrentUser } from '../lib/auth'

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
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }} />
    </GestureHandlerRootView>
  )
}
