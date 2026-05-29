import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

interface WeeklyInsightsCardProps {
  week: number
  today: number
  total: number
  streak: number
  goal: number
}

export function WeeklyInsightsCard({ week, today, total, streak, goal }: WeeklyInsightsCardProps) {
  if (total === 0 && week === 0) return null

  const weekAvg = week > 0 ? Math.round(week / 7) : 0
  let insight = 'Her gün kısa oturumlar uzun vadede fark yaratır.'
  if (streak >= 7) insight = 'Harika disiplin! Serini korumak öğrenmeyi 3× hızlandırır.'
  else if (today >= goal) insight = 'Bugünkü hedefin tamam — yarın flashcard ile pekiştir.'
  else if (week >= 20) insight = 'Bu hafta güçlü gidiyorsun. CEFR dağılımına profilden bak.'

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>HAFTALIK ÖZET</Text>
      <Text style={styles.insight}>{insight}</Text>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Ionicons name="calendar-outline" size={16} color="#60a5fa" />
          <Text style={styles.statVal}>{week}</Text>
          <Text style={styles.statLabel}>bu hafta</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="flame-outline" size={16} color="#fb923c" />
          <Text style={styles.statVal}>{streak}</Text>
          <Text style={styles.statLabel}>gün seri</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="trending-up-outline" size={16} color="#4ade80" />
          <Text style={styles.statVal}>{weekAvg}</Text>
          <Text style={styles.statLabel}>ort / gün</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  insight: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 22, marginBottom: 14 },
  row: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statVal: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
})
