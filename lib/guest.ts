import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'guest_mode'

export async function enableGuestMode() {
  await AsyncStorage.setItem(KEY, 'true')
}

export async function disableGuestMode() {
  await AsyncStorage.removeItem(KEY)
}

export async function isGuestMode(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEY)
  return val === 'true'
}
