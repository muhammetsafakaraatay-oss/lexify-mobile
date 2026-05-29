import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../lib/theme'
import { PRO_FEATURES } from '../lib/plan'

interface PremiumGateProps {
  feature: 'camera' | 'video' | 'voice'
  title: string
  description: string
}

const ICONS = {
  camera: 'camera-outline' as const,
  video: 'play-circle-outline' as const,
  voice: 'mic-outline' as const,
}

export function PremiumGate({ feature, title, description }: PremiumGateProps) {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconRing}>
          <Ionicons name={ICONS[feature]} size={48} color={colors.accent} />
        </View>
        <Text style={styles.badge}>LEXIFY PRO</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.desc}>{description}</Text>

        <View style={styles.featureList}>
          {PRO_FEATURES.slice(0, 3).map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
              <Text style={styles.featureText}>{f.title}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.cta} onPress={() => router.push('/paywall')}>
          <Text style={styles.ctaText}>Pro'yu Dene</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.bg} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  badge: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  desc: { color: colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 300 },
  featureList: { width: '100%', maxWidth: 320, gap: 10, marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    width: '100%',
    maxWidth: 320,
    justifyContent: 'center',
  },
  ctaText: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  back: { marginTop: 16, padding: 12 },
  backText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
})
