import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'learning_journey_v1'

export type JourneyStepId = 'read' | 'save3' | 'flashcard' | 'quiz'

export interface JourneyStep {
  id: JourneyStepId
  title: string
  desc: string
  route: string
  icon: string
}

export const JOURNEY_STEPS: JourneyStep[] = [
  { id: 'read', title: 'İlk metni aç', desc: 'Örnek paragrafta kelimeye dokun', route: '/(tabs)/oku', icon: 'book-outline' },
  { id: 'save3', title: '3 kelime kaydet', desc: 'Anlamı görüp kaydet', route: '/(tabs)/oku', icon: 'bookmark-outline' },
  { id: 'flashcard', title: 'Flashcard çevir', desc: 'En az 1 kart çalış', route: '/(tabs)/study', icon: 'layers-outline' },
  { id: 'quiz', title: 'Quiz tamamla', desc: 'Eşleştirme oyununu bitir', route: '/(tabs)/study', icon: 'game-controller-outline' },
]

type JourneyState = Partial<Record<JourneyStepId, boolean>>

async function readState(): Promise<JourneyState> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as JourneyState) : {}
  } catch {
    return {}
  }
}

async function writeState(state: JourneyState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state))
}

export async function getJourneyState(): Promise<JourneyState> {
  return readState()
}

export async function markJourneyStep(id: JourneyStepId): Promise<void> {
  const state = await readState()
  if (state[id]) return
  state[id] = true
  await writeState(state)
}

export async function isJourneyComplete(): Promise<boolean> {
  const state = await readState()
  return JOURNEY_STEPS.every((s) => state[s.id])
}

export async function getJourneyProgress(): Promise<{ done: number; total: number; state: JourneyState }> {
  const state = await readState()
  const done = JOURNEY_STEPS.filter((s) => state[s.id]).length
  return { done, total: JOURNEY_STEPS.length, state }
}
