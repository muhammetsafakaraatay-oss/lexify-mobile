import { Platform } from 'react-native'

function getWebGatewayBase() {
  if (typeof window === 'undefined') return ''

  const { protocol, hostname, port } = window.location
  const isLocalPreview =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'

  if (isLocalPreview && port !== '5000') {
    return `${protocol}//${hostname}:5000`
  }

  return ''
}

export const WEB_GATEWAY_BASE = Platform.OS === 'web' ? getWebGatewayBase() : ''

export const API_BASE_URL =
  Platform.OS === 'web'
    ? WEB_GATEWAY_BASE
    : (process.env.EXPO_PUBLIC_API_BASE || 'https://lexitr.vercel.app')
