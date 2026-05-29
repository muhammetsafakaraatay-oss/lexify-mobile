import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { FadeInView } from './FadeInView'

export function ProUpsellBanner() {
  const router = useRouter()

  return (
    <FadeInView delay={80}>
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.88}
        onPress={() => router.push('/paywall')}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="diamond" size={20} color={colors.bg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Öğrenmeyi hızlandır</Text>
          <Text style={styles.sub}>OCR · video transcript · sınırsız kelime · sınırsız tekrar</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.5)" />
      </TouchableOpacity>
    </FadeInView>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.bg, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  sub: { color: 'rgba(0,0,0,0.65)', fontSize: 12, lineHeight: 16 },
})
