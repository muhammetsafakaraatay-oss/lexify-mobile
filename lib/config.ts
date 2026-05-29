import { Platform } from 'react-native'

const REMOTE_API = process.env.EXPO_PUBLIC_API_BASE || 'https://lexitr.vercel.app'

function isPrivateLanHost(host: string): boolean {
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

function isMobileWeb(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
}

/**
 * Metro / gateway üzerinden same-origin `/api` proxy kullanılsın mı?
 * Telefonda `localhost` telefonun kendisidir — proxy çalışmaz, doğrudan Vercel kullan.
 */
function shouldUseDevProxy(): boolean {
  if (typeof window === 'undefined') return false

  const host = window.location.hostname

  if (isLoopbackHost(host)) {
    if (isMobileWeb()) return false
    return true
  }

  if (isPrivateLanHost(host)) return true

  return false
}

/**
 * Web localhost / LAN: Metro veya `npm run proxy` üzerinden `/api` (CORS yok).
 * Web production / native / mobil localhost: doğrudan Vercel.
 */
function getWebApiBase(): string {
  if (typeof window === 'undefined') return REMOTE_API
  if (shouldUseDevProxy()) return ''
  return REMOTE_API
}

export const WEB_GATEWAY_BASE = Platform.OS === 'web' ? getWebApiBase() : ''

export const API_BASE_URL =
  Platform.OS === 'web' ? getWebApiBase() : REMOTE_API
