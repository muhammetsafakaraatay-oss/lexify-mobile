import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { cefrColors } from '../../lib/cefr'
import { getLevelGuide } from '../../lib/starterContent'
import type { CefrLevel } from '../../lib/prefs'

interface LevelPathCardProps {
  level: CefrLevel
}

export function LevelPathCard({ level }: LevelPathCardProps) {
  const router = useRouter()
  const guide = getLevelGuide(level)
  const accent = cefrColors[level] || colors.accent

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: accent + '40' }]}
      onPress={() => router.push('/(tabs)/catalog')}
      activeOpacity={0.88}
    >
      <View style={[styles.badge, { backgroundColor: accent + '18', borderColor: accent + '50' }]}>
        <Text style={[styles.badgeText, { color: accent }]}>{level} yolun</Text>
      </View>
      <Text style={styles.title}>{guide.headline}</Text>
      <Text style={styles.sub}>{guide.tip}</Text>
      <View style={styles.ctaRow}>
        <Text style={[styles.cta, { color: accent }]}>Seviyene uygun makaleler</Text>
        <Ionicons name="arrow-forward" size={16} color={accent} />
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  sub: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cta: { fontSize: 13, fontWeight: '700' },
})
