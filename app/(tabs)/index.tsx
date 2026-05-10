import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { supabase } from '../../lib/supabase'
import { isGuestMode } from '../../lib/guest'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const onboarded = await AsyncStorage.getItem('onboarding_done')
      if (!onboarded) {
        router.replace('/onboarding')
        return
      }
      const guest = await isGuestMode()
      if (guest) {
        router.replace('/(tabs)/catalog')
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.replace('/(tabs)/catalog')
      else router.replace('/auth/login')
    }
    check()
  }, [])

  return <View style={{ flex: 1, backgroundColor: '#080808' }} />
}
