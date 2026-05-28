import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View } from 'react-native'
import { getCurrentUser } from '../../lib/auth'
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
      const user = await getCurrentUser()
      if (user) router.replace('/(tabs)/dashboard')
      else router.replace('/auth/login')
    }
    check()
  }, [])

  return <View style={{ flex: 1, backgroundColor: '#080808' }} />
}
