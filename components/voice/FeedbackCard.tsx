import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../lib/theme'

export function FeedbackCard({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
})
