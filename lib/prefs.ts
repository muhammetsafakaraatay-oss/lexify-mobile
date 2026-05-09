import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Lokal kullanıcı tercihleri — onboarding'de seçilen, ayarlardan değiştirilebilen.
 * Şu an sadece "starter level" ve "günlük hedef" tutuluyor; ileride genişletilebilir.
 */

const KEYS = {
  level: 'user_level',
  dailyGoal: 'user_daily_goal',
  onboardingDone: 'onboarding_done',
} as const

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export interface UserPrefs {
  level: CefrLevel
  dailyGoal: number
  onboardingDone: boolean
}

const DEFAULTS: UserPrefs = {
  level: 'B1',
  dailyGoal: 10,
  onboardingDone: false,
}

function isCefr(value: string | null): value is CefrLevel {
  return value === 'A1' || value === 'A2' || value === 'B1' ||
         value === 'B2' || value === 'C1' || value === 'C2'
}

export async function getUserPrefs(): Promise<UserPrefs> {
  try {
    const entries = await AsyncStorage.multiGet([KEYS.level, KEYS.dailyGoal, KEYS.onboardingDone])
    const map = Object.fromEntries(entries) as Record<string, string | null>
    const rawGoal = Number(map[KEYS.dailyGoal])
    return {
      level: isCefr(map[KEYS.level]) ? map[KEYS.level] as CefrLevel : DEFAULTS.level,
      dailyGoal: Number.isFinite(rawGoal) && rawGoal > 0 ? rawGoal : DEFAULTS.dailyGoal,
      onboardingDone: map[KEYS.onboardingDone] === 'true',
    }
  } catch (e) {
    console.warn('[prefs] getUserPrefs failed:', e)
    return DEFAULTS
  }
}

export async function setUserLevel(level: CefrLevel): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.level, level) }
  catch (e) { console.warn('[prefs] setUserLevel failed:', e) }
}

export async function setDailyGoal(goal: number): Promise<void> {
  try { await AsyncStorage.setItem(KEYS.dailyGoal, String(goal)) }
  catch (e) { console.warn('[prefs] setDailyGoal failed:', e) }
}
