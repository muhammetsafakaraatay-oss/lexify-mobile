import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'

export default function TabsLayout() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/auth/login')
    })
  }, [])

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0a0a0a', borderTopColor: '#1a1a1a', borderTopWidth: 1 },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="collections" options={{ href: null }} />
      <Tabs.Screen name="quiz" options={{ href: null }} />
      <Tabs.Screen name="catalog" options={{ title: 'Keşfet', tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="oku" options={{ title: 'Oku', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="words" options={{ title: 'Kelimeler', tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="flashcards" options={{ href: null }} />
      <Tabs.Screen name="camera" options={{ title: 'Kamera', tabBarIcon: ({ color, size }) => <Ionicons name="camera-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="video" options={{ title: 'Video', tabBarIcon: ({ color, size }) => <Ionicons name="play-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  )
}
