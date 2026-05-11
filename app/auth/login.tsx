import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

WebBrowser.maybeCompleteAuthSession()

const FEATURES = [
  { icon: 'book-outline', text: 'Makalelerden kelime öğren' },
  { icon: 'layers-outline', text: 'SM-2 ile aralıklı tekrar' },
  { icon: 'bar-chart-outline', text: 'CEFR seviyeni takip et' },
  { icon: 'camera-outline', text: 'Kamerayla metin tara' },
]

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function signInWithGoogle() {
    setLoading(true)
    setError('')
    try {
      if (Platform.OS === 'web') {
        const redirectTo = typeof window !== 'undefined' ? window.location.origin : makeRedirectUri({ scheme: 'lexitr' })
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: false },
        })
        if (error) throw error
      } else {
        const redirectUri = makeRedirectUri({ scheme: 'lexitr' })
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUri, skipBrowserRedirect: true },
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
    } catch (e: any) {
      setError('Giriş başarısız. Lütfen tekrar deneyin.')
      console.error('Login error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.glow} />

      <View style={styles.top}>
        <View style={styles.logoWrap}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>Lexify</Text>
        </View>
        <Text style={styles.tagline}>İngilizce okurken kelime öğren</Text>
      </View>

      <View style={styles.featureList}>
        {FEATURES.map(({ icon, text }) => (
          <View key={icon} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={icon as any} size={16} color={colors.accent} />
            </View>
            <Text style={styles.featureText}>{text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bottom}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.googleBtnDisabled]}
          onPress={signInWithGoogle}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <>
              <View style={styles.googleIconWrap}>
                <Text style={styles.googleG}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Google ile Giriş Yap</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.legalText}>
          Giriş yaparak{' '}
          <Text style={styles.legalLink}>Kullanım Koşulları</Text>
          {'nı ve '}
          <Text style={styles.legalLink}>Gizlilik Politikası</Text>
          {'nı kabul etmiş olursunuz.'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  glow: {
    position: 'absolute',
    top: -100,
    left: '50%',
    marginLeft: -180,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(250,204,21,0.06)',
  },
  top: { alignItems: 'flex-start' },
  logoWrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12 },
  logoDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.accent,
    marginRight: 6, marginBottom: 10,
  },
  logoText: { fontSize: 52, fontWeight: '800', color: colors.text, letterSpacing: -2 },
  tagline: { fontSize: 17, color: colors.textMuted, lineHeight: 25, maxWidth: 260 },

  featureList: {
    gap: 14,
    paddingVertical: 12,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentDim,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)',
  },
  featureText: { color: colors.text, fontSize: 15, fontWeight: '500' },

  bottom: { gap: 14 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 12, padding: 12,
  },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },

  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: colors.accent,
    borderRadius: 16, paddingVertical: 17,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  googleBtnDisabled: { opacity: 0.7 },
  googleIconWrap: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  googleG: { fontSize: 15, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },

  legalText: { color: colors.textDim, fontSize: 11, textAlign: 'center', lineHeight: 17 },
  legalLink: { color: colors.textMuted, textDecorationLine: 'underline' },
})
