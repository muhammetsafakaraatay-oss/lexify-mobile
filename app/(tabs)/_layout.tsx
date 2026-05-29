import { Tabs } from 'expo-router'
import { colors } from '../../lib/theme'
import { Ionicons } from '@expo/vector-icons'

const hiddenTabOptions = {
  href: null,
} as const

export default function TabsLayout() {
  const icon =
    (
      outline: React.ComponentProps<typeof Ionicons>['name'],
      filled: React.ComponentProps<typeof Ionicons>['name'],
    ) =>
    ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
      <Ionicons name={focused ? filled : outline} size={size} color={color} />

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: '#0a0a0a',
        borderTopColor: '#1a1a1a',
        borderTopWidth: 1,
        height: 60,
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarShowLabel: true,
      tabBarLabelStyle: { fontSize: 9, fontWeight: '600' },
      tabBarItemStyle: { paddingHorizontal: 0 },
    }}>
      <Tabs.Screen name="index" options={hiddenTabOptions} />
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarLabel: 'Ana', tabBarIcon: icon('home-outline', 'home') }}
      />
      <Tabs.Screen name="history" options={hiddenTabOptions} />
      <Tabs.Screen name="search" options={hiddenTabOptions} />
      <Tabs.Screen name="collections" options={hiddenTabOptions} />
      <Tabs.Screen name="quiz" options={hiddenTabOptions} />
      <Tabs.Screen name="reverse-quiz" options={hiddenTabOptions} />
      <Tabs.Screen name="passport" options={hiddenTabOptions} />
      <Tabs.Screen name="duel" options={hiddenTabOptions} />
      <Tabs.Screen name="audio-text" options={hiddenTabOptions} />
      <Tabs.Screen name="widget" options={hiddenTabOptions} />
      <Tabs.Screen name="wrapped" options={hiddenTabOptions} />
      <Tabs.Screen name="story/index" options={hiddenTabOptions} />
      <Tabs.Screen name="story/archive" options={hiddenTabOptions} />
      <Tabs.Screen
        name="catalog"
        options={{ tabBarLabel: 'Keşfet', tabBarIcon: icon('compass-outline', 'compass') }}
      />
      <Tabs.Screen
        name="oku"
        options={{ tabBarLabel: 'Oku', tabBarIcon: icon('book-outline', 'book') }}
      />
      <Tabs.Screen
        name="study"
        options={{ tabBarLabel: 'Çalış', tabBarIcon: icon('school-outline', 'school') }}
      />
      <Tabs.Screen name="sesli/index" options={hiddenTabOptions} />
      <Tabs.Screen name="sesli/prompt" options={hiddenTabOptions} />
      <Tabs.Screen name="sesli/recording" options={hiddenTabOptions} />
      <Tabs.Screen name="sesli/processing" options={hiddenTabOptions} />
      <Tabs.Screen name="sesli/result" options={hiddenTabOptions} />
      <Tabs.Screen name="sesli/archive" options={hiddenTabOptions} />
      <Tabs.Screen
        name="words"
        options={{ tabBarLabel: 'Kelime', tabBarIcon: icon('list-outline', 'list') }}
      />
      <Tabs.Screen name="flashcards" options={hiddenTabOptions} />
      <Tabs.Screen name="writing" options={hiddenTabOptions} />
      <Tabs.Screen name="camera" options={hiddenTabOptions} />
      <Tabs.Screen name="video" options={hiddenTabOptions} />
      <Tabs.Screen name="practice" options={hiddenTabOptions} />
      <Tabs.Screen
        name="profile"
        options={{ tabBarLabel: 'Profil', tabBarIcon: icon('person-outline', 'person') }}
      />
    </Tabs>
  )
}
