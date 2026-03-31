import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { supabase } from '../../lib/supabase'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/(tabs)/dashboard')
      else router.replace('/auth/login')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/(tabs)/dashboard')
      else router.replace('/auth/login')
    })

    return () => subscription.unsubscribe()
  }, [])

  return <View style={{ flex: 1, backgroundColor: '#080808' }} />
}
