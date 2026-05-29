import { useCallback, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'
import { getJourneyProgress, isJourneyComplete, JOURNEY_STEPS } from '../../lib/journey'

export function FirstWinCard() {
  const router = useRouter()
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(4)
  const [state, setState] = useState<Record<string, boolean>>({})
  const [hidden, setHidden] = useState(false)

  const refresh = useCallback(async () => {
    if (await isJourneyComplete()) {
      setHidden(true)
      return
    }
    const p = await getJourneyProgress()
    setDone(p.done)
    setTotal(p.total)
    setState(p.state)
  }, [])

  useFocusEffect(useCallback(() => { void refresh() }, [refresh]))

  if (hidden) return null

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>İLK 5 DAKİKA</Text>
          <Text style={styles.title}>Öğrenme döngünü kur</Text>
        </View>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.steps}>
        {JOURNEY_STEPS.map((step) => {
          const complete = !!state[step.id]
          return (
            <TouchableOpacity
              key={step.id}
              style={[styles.step, complete && styles.stepDone]}
              onPress={() => router.push(step.route as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.stepIcon, complete && styles.stepIconDone]}>
                <Ionicons
                  name={complete ? 'checkmark' : (step.icon as any)}
                  size={14}
                  color={complete ? '#4ade80' : colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, complete && styles.stepTitleDone]}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
              {!complete ? (
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              ) : null}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.2)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginBottom: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  pct: { color: colors.accent, fontSize: 22, fontWeight: '800' },
  bar: { height: 4, backgroundColor: '#1a1a1a', borderRadius: 2, marginBottom: 14, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.accent },
  steps: { gap: 8 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDone: { borderColor: 'rgba(74,222,128,0.25)', opacity: 0.85 },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconDone: { backgroundColor: 'rgba(74,222,128,0.12)' },
  stepTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  stepTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  stepDesc: { color: colors.textDim, fontSize: 11, marginTop: 1 },
})
