import { Stack } from 'expo-router'

export default function DeckLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="study" />
      <Stack.Screen name="match" />
      <Stack.Screen name="edit" />
    </Stack>
  )
}
