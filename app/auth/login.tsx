import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { useRouter } from 'expo-router'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function signInWithGoogle() {
    setLoading(true)
    try {
      if (Platform.OS === 'web') {
        const redirectTo = typeof window !== 'undefined' ? window.location.origin : makeRedirectUri({ scheme: 'lexitr' })
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: false,
          },
        })
        if (error) throw error
      } else {
        const redirectUri = makeRedirectUri({ scheme: 'lexitr' })
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
          },
        })
        if (error) throw error
        if (data.url) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri)
          if (result.type === 'success') {
            const hash = result.url.split('#')[1] || ''
            const params = new URLSearchParams(hash)
            const access_token = params.get('access_token')
            const refresh_token = params.get('refresh_token') || ''
            if (access_token) {
              await supabase.auth.setSession({ access_token, refresh_token })
              router.replace('/(tabs)/dashboard')
            }
          }
        }
      }
    } catch (e) {
      console.error('Login error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>Lexify</Text>
        <View style={styles.dot} />
      </View>
      <Text style={styles.subtitle}>Ingilizce okurken kelime ogren</Text>
      <TouchableOpacity style={styles.btn} onPress={signInWithGoogle} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={styles.btnText}>Google ile Giris Yap</Text>
        }
      </TouchableOpacity>
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
  btnText: { color: colors.bg, fontWeight: '700', fontSize: 16 },
})
