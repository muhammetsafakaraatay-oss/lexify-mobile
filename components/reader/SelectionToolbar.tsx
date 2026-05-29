import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../lib/theme'

interface SelectionToolbarProps {
  visible: boolean
  count: number
  translating: boolean
  onClear: () => void
  onTranslate: () => void
  onClose: () => void
}

export function SelectionToolbar({
  visible,
  count,
  translating,
  onClear,
  onTranslate,
  onClose,
}: SelectionToolbarProps) {
  if (!visible) return null

  return (
    <Animated.View
      entering={FadeInDown.duration(220).springify()}
      exiting={FadeOutDown.duration(180)}
      style={styles.wrap}
    >
      <View style={styles.bar}>
        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.count}>
          {count === 0 ? 'Kelime seç' : `${count} kelime`}
        </Text>

        {count > 0 ? (
          <TouchableOpacity onPress={onClear} hitSlop={8}>
            <Text style={styles.clearText}>Temizle</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 52 }} />
        )}

        <TouchableOpacity
          style={[styles.translateBtn, count === 0 && styles.translateBtnDisabled]}
          onPress={onTranslate}
          disabled={count === 0 || translating}
          activeOpacity={0.88}
        >
          {translating ? (
            <ActivityIndicator color={colors.bg} size="small" />
          ) : (
            <>
              <Ionicons name="language-outline" size={15} color={colors.bg} />
              <Text style={styles.translateText}>Çevir</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20,20,20,0.94)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconBtn: { padding: 4 },
  count: { flex: 1, color: colors.textDim, fontSize: 13, fontWeight: '600' },
  clearText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 76,
    justifyContent: 'center',
  },
  translateBtnDisabled: { opacity: 0.35 },
  translateText: { color: colors.bg, fontSize: 13, fontWeight: '800' },
})
