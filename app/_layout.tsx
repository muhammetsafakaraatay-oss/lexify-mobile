import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { supabase } from '../lib/supabase'
import { useRouter, useSegments } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

export default function RootLayout() {
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(true)
      const inAuth = segments[0] === 'auth'
      if (!session && !inAuth) router.replace('/auth/login')
      if (session && inAuth) router.replace('/(tabs)/')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const inAuth = segments[0] === 'auth'
      if (!session && !inAuth) router.replace('/auth/login')
      if (session && inAuth) router.replace('/(tabs)/')
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#080808' }} />

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }} />
    </GestureHandlerRootView>
  )
}
