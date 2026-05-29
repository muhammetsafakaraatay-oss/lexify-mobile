import { View, Text, StyleSheet } from 'react-native'
import { ACHIEVEMENTS, AchievementId } from '../../lib/achievements'
import { colors } from '../../lib/theme'

interface AchievementListProps {
  unlocked: AchievementId[]
  compact?: boolean
}

export function AchievementList({ unlocked, compact }: AchievementListProps) {
  const set = new Set(unlocked)

  return (
    <View style={[styles.grid, compact && styles.gridCompact]}>
      {ACHIEVEMENTS.map((a) => {
        const on = set.has(a.id)
        return (
          <View key={a.id} style={[styles.item, !on && styles.itemLocked]}>
            <Text style={[styles.icon, !on && styles.iconLocked]}>{on ? a.icon : '🔒'}</Text>
            <Text style={[styles.title, !on && styles.titleLocked]} numberOfLines={1}>
              {a.title}
            </Text>
            {!compact ? (
              <Text style={styles.desc} numberOfLines={2}>{on ? a.desc : '???'}</Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCompact: { gap: 8 },
  item: {
    width: '47%',
    backgroundColor: colors.bgSurface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
  },
  itemLocked: { borderColor: colors.border, opacity: 0.65 },
  icon: { fontSize: 22, marginBottom: 6 },
  iconLocked: { opacity: 0.5 },
  title: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  titleLocked: { color: colors.textMuted },
  desc: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
})
