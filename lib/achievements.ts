import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'achievements_unlocked_v1'

export type AchievementId =
  | 'first_word'
  | 'words_10'
  | 'words_50'
  | 'streak_3'
  | 'streak_7'
  | 'mastered_5'
  | 'quiz_done'
  | 'practice_done'

export interface AchievementDef {
  id: AchievementId
  title: string
  desc: string
  icon: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_word', title: 'İlk Adım', desc: 'İlk kelimeni kaydettin', icon: '🌱' },
  { id: 'words_10', title: 'Kelime Avcısı', desc: '10 kelime kaydettin', icon: '📚' },
  { id: 'words_50', title: 'Sözlük Kurucu', desc: '50 kelime kaydettin', icon: '🏆' },
  { id: 'streak_3', title: '3 Gün Seri', desc: '3 gün üst üste aktif oldun', icon: '🔥' },
  { id: 'streak_7', title: 'Haftalık Disiplin', desc: '7 günlük seri', icon: '⚡' },
  { id: 'mastered_5', title: 'Ustalaşma', desc: '5 kelimeyi öğrendin', icon: '✨' },
  { id: 'quiz_done', title: 'Quiz Ustası', desc: 'İlk quiz oturumunu tamamladın', icon: '🎮' },
  { id: 'practice_done', title: 'Hızlı Pratik', desc: 'Hızlı pratik oturumunu bitirdin', icon: '⚡' },
]

export interface AchievementStats {
  totalWords: number
  mastered: number
  streak: number
  quizCompleted?: boolean
  practiceCompleted?: boolean
}

async function readUnlocked(): Promise<Set<AchievementId>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as AchievementId[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

async function writeUnlocked(ids: Set<AchievementId>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

function computeNewUnlocks(stats: AchievementStats, unlocked: Set<AchievementId>): AchievementId[] {
  const next: AchievementId[] = []
  const tryAdd = (id: AchievementId, cond: boolean) => {
    if (cond && !unlocked.has(id)) next.push(id)
  }

  tryAdd('first_word', stats.totalWords >= 1)
  tryAdd('words_10', stats.totalWords >= 10)
  tryAdd('words_50', stats.totalWords >= 50)
  tryAdd('streak_3', stats.streak >= 3)
  tryAdd('streak_7', stats.streak >= 7)
  tryAdd('mastered_5', stats.mastered >= 5)
  tryAdd('quiz_done', !!stats.quizCompleted)
  tryAdd('practice_done', !!stats.practiceCompleted)

  return next
}

/** Yeni açılan rozetleri döndürür ve kalıcı olarak kaydeder. */
export async function syncAchievements(stats: AchievementStats): Promise<AchievementId[]> {
  const unlocked = await readUnlocked()
  const fresh = computeNewUnlocks(stats, unlocked)
  if (fresh.length === 0) return []

  for (const id of fresh) unlocked.add(id)
  await writeUnlocked(unlocked)
  return fresh
}

export async function getUnlockedAchievements(): Promise<AchievementId[]> {
  return [...(await readUnlocked())]
}

async function unlockOne(id: AchievementId): Promise<AchievementId[]> {
  const unlocked = await readUnlocked()
  if (unlocked.has(id)) return []
  unlocked.add(id)
  await writeUnlocked(unlocked)
  return [id]
}

export function markQuizCompleted(): Promise<AchievementId[]> {
  return unlockOne('quiz_done')
}

export function markPracticeCompleted(): Promise<AchievementId[]> {
  return unlockOne('practice_done')
}
