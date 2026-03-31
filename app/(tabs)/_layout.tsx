import { Tabs } from 'expo-router'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

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
      <Tabs.Screen name="index" options={{
        title: 'Oku',
        tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />
      }} />
      <Tabs.Screen name="flashcards" options={{
        title: 'Kartlar',
        tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color} />
      }} />
      <Tabs.Screen name="words" options={{
        title: 'Kelimeler',
        tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />
      }} />
      <Tabs.Screen name="collections" options={{
        title: 'Listeler',
        tabBarIcon: ({ color, size }) => <Ionicons name="folder-outline" size={size} color={color} />
      }} />
      <Tabs.Screen name="dashboard" options={{
        title: 'Dashboard',
        tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />
      }} />
    </Tabs>
  )
}
