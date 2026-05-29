import { Stack } from 'expo-router'

export default function FlashcardsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[deckId]/index" />
      <Stack.Screen name="[deckId]/study" />
      <Stack.Screen name="[deckId]/match" />
      <Stack.Screen name="[deckId]/edit" />
    </Stack>
  )
}
