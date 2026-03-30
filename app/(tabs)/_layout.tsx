import { Tabs } from 'expo-router'
import { colors } from '../../lib/theme'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#0a0a0a',
        borderTopColor: '#1a1a1a',
        borderTopWidth: 1,
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Oku' }} />
      <Tabs.Screen name="flashcards" options={{ title: 'Kartlar' }} />
      <Tabs.Screen name="words" options={{ title: 'Kelimeler' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
    </Tabs>
  )
}
