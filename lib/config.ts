import { Platform } from 'react-native'

const VERCEL_API = 'https://lexitr.vercel.app'

function getApiBaseUrl(): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return process.env.EXPO_PUBLIC_API_BASE || VERCEL_API
  }
  const hostname = window.location.hostname
  // Replit dev domain format: {id}-00-{slug}.{cluster}.replit.dev
  // Proxy runs on port 3001 → {id}-3001-{slug}.{cluster}.replit.dev
  const proxyHostname = hostname.replace(/-00-/, '-3001-')
  if (proxyHostname !== hostname) {
    return `https://${proxyHostname}`
  }
  return process.env.EXPO_PUBLIC_API_BASE || VERCEL_API
}

export const API_BASE_URL = getApiBaseUrl()
