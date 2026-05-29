import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

export function CountdownTimer({
  seconds,
  label,
}: {
  seconds: number
  label?: string
}) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.value}>{seconds}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  value: {
    color: '#2563EB',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 72,
  },
})
