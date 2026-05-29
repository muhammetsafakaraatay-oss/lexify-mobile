import { Stack } from 'expo-router'

export default function WritingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="prompts" />
      <Stack.Screen name="[draftId]" />
      <Stack.Screen name="feedback/[draftId]" />
    </Stack>
  )
}
