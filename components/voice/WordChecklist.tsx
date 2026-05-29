import { View, Text, StyleSheet } from 'react-native'
import type { VoiceWordChecklistItem } from '../../lib/voice'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

export function WordChecklist({ items }: { items: VoiceWordChecklistItem[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Hedef Kelimeler</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <View key={item.word} style={styles.row}>
            <Ionicons
              name={item.used ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={item.used ? '#22C55E' : colors.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.word}>{item.word}</Text>
              <Text style={styles.sub}>
                {item.used ? 'Kullanildi' : 'Bu denemede gecmedi'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  word: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
})
