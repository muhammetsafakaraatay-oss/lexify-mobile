import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { enableGuestMode } from '../../lib/guest'
import { colors } from '../../lib/theme'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  async function signInWithGoogle() {
    setLoading(true)
    setErrorMsg(null)
    try {
      if (Platform.OS === 'web') {
        const redirectTo = typeof window !== 'undefined'
          ? window.location.origin
          : makeRedirectUri({ scheme: 'lexitr' })

        console.log('[auth] redirectTo:', redirectTo)
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo },
        })
        if (error) {
          console.error('[auth] error:', error.status, error.message)
          setErrorMsg(`Hata ${error.status ?? ''}: ${error.message}`)
          return
        }
        console.log('[auth] OAuth URL:', data?.url ? 'ok' : 'none')
        return
      }

      const redirectUri = makeRedirectUri({ scheme: 'lexitr' })
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      })
      if (error) {
        setErrorMsg(`Hata ${error.status ?? ''}: ${error.message}`)
        return
      }
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri)
        if (result.type === 'success') {
          const hash = result.url.split('#')[1] || ''
          const params = new URLSearchParams(hash)
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token') || ''
          if (access_token) {
            await supabase.auth.setSession({ access_token, refresh_token })
          }
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Beklenmeyen bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  async function continueAsGuest() {
    await enableGuestMode()
    router.replace('/(tabs)/catalog')
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>Lexify</Text>
        <View style={styles.dot} />
      </View>
      <Text style={styles.subtitle}>İngilizce okurken kelime öğren</Text>

      <TouchableOpacity style={styles.btn} onPress={signInWithGoogle} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : (
            <View style={styles.btnInner}>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.btnText}>Google ile Giriş Yap</Text>
            </View>
          )
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.guestBtn} onPress={continueAsGuest}>
        <Text style={styles.guestText}>Misafir olarak devam et</Text>
      </TouchableOpacity>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {__DEV__ && (
        <Text style={styles.devHint}>
          redirect: {typeof window !== 'undefined' ? window.location.origin : 'native'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  logoText: { fontSize: 48, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, marginLeft: 4, marginBottom: 10 },
  subtitle: { fontSize: 16, color: colors.textMuted, marginBottom: 48 },
  btn: { backgroundColor: colors.accent, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, width: '100%', alignItems: 'center' },
  btnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleG: { fontSize: 18, fontWeight: '800', color: colors.bg },
  btnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
  guestBtn: { marginTop: 14, paddingVertical: 14, width: '100%', alignItems: 'center' },
  guestText: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },
  errorBox: { marginTop: 20, backgroundColor: '#2a0a0a', borderWidth: 1, borderColor: '#f87171', borderRadius: 10, padding: 14, width: '100%' },
  errorText: { color: '#f87171', fontSize: 13, textAlign: 'center' },
  devHint: { fontSize: 10, color: '#333', marginTop: 24, textAlign: 'center' },
})
