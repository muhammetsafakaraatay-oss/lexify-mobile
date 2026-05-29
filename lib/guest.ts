import AsyncStorage from '@react-native-async-storage/async-storage'

const GUEST_KEY = 'guest_mode_v1'
const FIRST_SESSION_KEY = 'first_session_active_v1'

export async function enableGuestMode(): Promise<void> {
  await AsyncStorage.setItem(GUEST_KEY, 'true')
}

export async function disableGuestMode(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_KEY)
}

export async function isGuestMode(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_KEY)) === 'true'
}

export async function setFirstSessionActive(active: boolean): Promise<void> {
  if (active) await AsyncStorage.setItem(FIRST_SESSION_KEY, 'true')
  else await AsyncStorage.removeItem(FIRST_SESSION_KEY)
}

export async function isFirstSessionActive(): Promise<boolean> {
  return (await AsyncStorage.getItem(FIRST_SESSION_KEY)) === 'true'
}
