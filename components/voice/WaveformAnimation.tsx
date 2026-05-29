import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'

const BAR_COUNT = 18

export function WaveformAnimation({
  level,
  active,
}: {
  level: number
  active: boolean
}) {
  const bars = useMemo(() => {
    const normalized = Math.max(0.12, Math.min(1, level))
    return Array.from({ length: BAR_COUNT }, (_, index) => {
      const wave = Math.sin((index / BAR_COUNT) * Math.PI)
      const base = active ? 16 : 10
      return base + wave * 40 * normalized
    })
  }, [active, level])

  return (
    <View style={styles.row}>
      {bars.map((height, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            {
              height,
              opacity: active ? 0.6 + (index / BAR_COUNT) * 0.4 : 0.35,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 80,
  },
  bar: {
    width: 8,
    borderRadius: 999,
    backgroundColor: '#2563EB',
  },
})
