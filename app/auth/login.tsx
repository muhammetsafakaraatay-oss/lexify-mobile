import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('code=')) {
        const code = new URL(url).searchParams.get('code')
        if (code) supabase.auth.exchangeCodeForSession(code)
      }
    })
    return () => sub.remove()
  }, [])

  async function signInWithGoogle() {
    console.log('Button pressed')
    setLoading(true)
    try {
      const redirectUri = makeRedirectUri({ scheme: 'lexitr' })
      console.log('Redirect URI:', redirectUri)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      })
      if (error) { console.error(error); return }
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri)
        console.log('Auth result:', result.type)
        if (result.type === 'success') {
          const url = new URL(result.url)
          const code = url.searchParams.get('code')
          if (code) await supabase.auth.exchangeCodeForSession(code)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>LexiTR</Text>
        <View style={styles.dot} />
      </View>
      <Text style={styles.subtitle}>İngilizce okurken kelime öğren</Text>
      <TouchableOpacity style={styles.btn} onPress={signInWithGoogle} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.bg} />
          : <Text style={styles.btnText}>Google ile Giriş Yap</Text>
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
