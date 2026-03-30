import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'
import { View } from 'react-native'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      setReady(true)
      router.replace('/(tabs)/')
    })
  }, [])

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#080808' }} />

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }} />
    </GestureHandlerRootView>
  )
}
