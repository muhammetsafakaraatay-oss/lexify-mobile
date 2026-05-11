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
  { icon: 'book-outline' as const, text: 'Makale & Video', sub: 'Gerçek içerikle öğren' },
  { icon: 'layers-outline' as const, text: 'SM-2 Tekrar', sub: 'Aralıklı tekrar sistemi' },
  { icon: 'bar-chart-outline' as const, text: 'CEFR Takip', sub: 'Seviyeni ölç ve geliştir' },
  { icon: 'camera-outline' as const, text: 'Kamera OCR', sub: 'Metni tara, anında çevir' },
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
      <View style={styles.accentBar} />

      <View style={styles.hero}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>L</Text>
          </View>
          <Text style={styles.logoText}>Lexify</Text>
        </View>

        <Text style={styles.headline}>İngilizce öğrenmek{'\n'}hiç bu kadar kolay olmamıştı</Text>
        <Text style={styles.tagline}>
          Gerçek makaleler, videolar ve kamera ile bağlamında öğren. SM-2 algoritması seni takip eder.
        </Text>
      </View>

      <View style={styles.featureGrid}>
        {FEATURES.map(({ icon, text, sub }) => (
          <View key={icon} style={styles.featureCard}>
            <View style={styles.featureIconWrap}>
              <Ionicons name={icon} size={20} color={colors.accent} />
            </View>
            <Text style={styles.featureTitle}>{text}</Text>
            <Text style={styles.featureSub}>{sub}</Text>
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
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },

  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accent,
  },

  hero: {
    paddingTop: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkText: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.bg,
    letterSpacing: -1,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },

  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: '47%',
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.2)',
  },
  featureTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  featureSub: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },

  bottom: {
    gap: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: '#f87171', fontSize: 13, flex: 1 },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  googleBtnDisabled: { opacity: 0.7 },
  googleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: { fontSize: 15, fontWeight: '800', color: '#4285F4' },
  googleBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },

  legalText: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  legalLink: { color: colors.textMuted, textDecorationLine: 'underline' },
})
