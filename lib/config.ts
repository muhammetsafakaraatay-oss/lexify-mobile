import { Platform } from 'react-native'

export const API_BASE_URL =
  Platform.OS === 'web' ? '' : (process.env.EXPO_PUBLIC_API_BASE || 'https://lexitr.vercel.app')
