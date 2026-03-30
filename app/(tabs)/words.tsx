import { View, Text } from 'react-native'
import { colors } from '../../lib/theme'

export default function Screen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.textMuted }}>Yapiyor...</Text>
    </View>
  )
}
