import { useEffect, useRef } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Notifications from 'expo-notifications'
import { supabase } from '../lib/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export default function RootLayout() {
  const router = useRouter()
  const segments = useSegments()
  const segmentsRef = useRef(segments)

  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && segmentsRef.current[0] === 'auth') {
        router.replace('/(tabs)/dashboard')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const segs = segmentsRef.current
      const inAuth = segs[0] === 'auth'
      const inOnboarding = segs[0] === 'onboarding'

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        if (inAuth) router.replace('/(tabs)/dashboard')
      } else if (event === 'SIGNED_OUT') {
        if (!inAuth && !inOnboarding) router.replace('/auth/login')
      }
    })

    const notifSub = Notifications.addNotificationReceivedListener(() => {})

    return () => {
      subscription.unsubscribe()
      notifSub.remove()
    }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }} />
    </GestureHandlerRootView>
  )
}
