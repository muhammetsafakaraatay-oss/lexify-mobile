import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

function scoreColor(score: number) {
  if (score >= 76) return '#22C55E'
  if (score >= 51) return '#F59E0B'
  return '#DC2626'
}

export function ScoreCircle({ score }: { score: number }) {
  const tint = scoreColor(score)
  return (
    <View style={[styles.outer, { borderColor: `${tint}55`, backgroundColor: `${tint}14` }]}>
      <View style={[styles.inner, { borderColor: tint }]}>
        <Text style={[styles.score, { color: tint }]}>{score}</Text>
        <Text style={styles.label}>genel skor</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    width: 152,
    height: 152,
    borderRadius: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inner: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  score: {
    fontSize: 34,
    fontWeight: '900',
  },
  label: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
})
