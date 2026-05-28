import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { colors } from '../../lib/theme'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getCurrentUser, signIn } from '../../lib/auth'

const FEATURES = [
  { icon: 'book-outline' as const, text: 'Makale & Video', sub: 'Gerçek içerikle öğren' },
  { icon: 'layers-outline' as const, text: 'SM-2 Tekrar', sub: 'Aralıklı tekrar sistemi' },
  { icon: 'bar-chart-outline' as const, text: 'CEFR Takip', sub: 'Seviyeni ölç ve geliştir' },
  { icon: 'camera-outline' as const, text: 'Kamera OCR', sub: 'Metni tara, anında çevir' },
]

export default function LoginScreen() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentUser().then(user => {
      if (user) router.replace('/(tabs)/dashboard')
    })
  }, [])

  function handleLogin() {
    setLoading(true)
    signIn()
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
        <TouchableOpacity
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <>
              <Ionicons name="person-outline" size={20} color={colors.bg} />
              <Text style={styles.loginBtnText}>Giriş Yap</Text>
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
  hero: { paddingTop: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoMark: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoMarkText: { fontSize: 22, fontWeight: '900', color: colors.bg, letterSpacing: -1 },
  logoText: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  headline: { fontSize: 26, fontWeight: '800', color: colors.text, lineHeight: 34, letterSpacing: -0.5, marginBottom: 12 },
  tagline: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  featureCard: { width: '47%', backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8 },
  featureIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)' },
  featureTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  featureSub: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  bottom: { gap: 12 },
  loginBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  legalText: { color: colors.textDim, fontSize: 11, textAlign: 'center', lineHeight: 17 },
  legalLink: { color: colors.textMuted, textDecorationLine: 'underline' },
})
