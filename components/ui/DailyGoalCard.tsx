import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '../../lib/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const SIZE = 72
const STROKE = 6
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R

interface DailyGoalCardProps {
  today: number
  goal: number
}

export function DailyGoalCard({ today, goal }: DailyGoalCardProps) {
  const progress = useSharedValue(0)
  const pct = goal > 0 ? Math.min(today / goal, 1) : 0
  const done = today >= goal

  useEffect(() => {
    progress.value = withSpring(pct, { damping: 16, stiffness: 90 })
  }, [pct, progress])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }))

  return (
    <View style={styles.card}>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="#1a1a1a"
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={done ? '#4ade80' : colors.accent}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            animatedProps={animatedProps}
            rotation="-90"
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.ringNum, done && { color: '#4ade80' }]}>{today}</Text>
          <Text style={styles.ringGoal}>/{goal}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.label}>GÜNLÜK HEDEF</Text>
        <Text style={styles.title}>
          {done ? 'Hedef tamamlandı! 🎉' : `${goal - today} kelime kaldı`}
        </Text>
        <Text style={styles.sub}>
          {done
            ? 'Serini korumak için flashcard ile tekrar et.'
            : 'Okurken kelime kaydet, hedefe yaklaş.'}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
  },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringNum: { fontSize: 20, fontWeight: '800', color: colors.accent },
  ringGoal: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginTop: -2 },
  copy: { flex: 1 },
  label: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sub: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
})
