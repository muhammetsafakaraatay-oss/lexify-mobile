import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  quizSessions: 'usage_quiz_sessions_v1',
  savesToday: 'usage_saves_today_v1',
  reverseQuizAttempts: 'usage_reverse_quiz_attempts_v1',
} as const

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

async function readDayMap(key: string): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

async function writeDayMap(key: string, map: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(map))
}

export async function getTodaySaveCount(): Promise<number> {
  const map = await readDayMap(KEYS.savesToday)
  return map[todayKey()] ?? 0
}

export async function incrementTodaySaveCount(): Promise<number> {
  const day = todayKey()
  const map = await readDayMap(KEYS.savesToday)
  map[day] = (map[day] ?? 0) + 1
  await writeDayMap(KEYS.savesToday, map)
  return map[day]
}

export async function getTodayQuizSessions(): Promise<number> {
  const map = await readDayMap(KEYS.quizSessions)
  return map[todayKey()] ?? 0
}

export async function incrementTodayQuizSessions(): Promise<number> {
  const day = todayKey()
  const map = await readDayMap(KEYS.quizSessions)
  map[day] = (map[day] ?? 0) + 1
  await writeDayMap(KEYS.quizSessions, map)
  return map[day]
}

export async function getTodayReverseQuizAttempts(): Promise<number> {
  const map = await readDayMap(KEYS.reverseQuizAttempts)
  return map[todayKey()] ?? 0
}

export async function incrementTodayReverseQuizAttempts(): Promise<number> {
  const day = todayKey()
  const map = await readDayMap(KEYS.reverseQuizAttempts)
  map[day] = (map[day] ?? 0) + 1
  await writeDayMap(KEYS.reverseQuizAttempts, map)
  return map[day]
}
