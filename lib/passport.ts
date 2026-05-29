import type { SavedWord } from './data'

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type PassportLevel = typeof CEFR_LEVELS[number]

const LEVEL_TARGETS: Record<PassportLevel, number> = {
  A1: 120,
  A2: 180,
  B1: 240,
  B2: 320,
  C1: 380,
  C2: 450,
}

export interface PassportLevelProgress {
  level: PassportLevel
  known: number
  target: number
  pct: number
  unlocked: boolean
  completed: boolean
}

export function buildPassportProgress(words: SavedWord[]): PassportLevelProgress[] {
  const counts = new Map<PassportLevel, number>()
  words.forEach((word) => {
    const level = (word.cefr_level || word.cefr) as PassportLevel | undefined
    if (level && CEFR_LEVELS.includes(level)) {
      counts.set(level, (counts.get(level) || 0) + 1)
    }
  })

  return CEFR_LEVELS.map((level) => {
    const known = counts.get(level) || 0
    const target = LEVEL_TARGETS[level]
    const pct = Math.min(100, Math.round((known / target) * 100))
    return {
      level,
      known,
      target,
      pct,
      unlocked: pct >= 25,
      completed: pct >= 85,
    }
  })
}

export function passportFocusHint(progress: PassportLevelProgress[]) {
  const next = progress.find((item) => !item.completed)
  if (!next) return 'C2 yolculuğunda görünür bir birikim var. Şimdi nadir kelimeleri bağlam içinde kovala.'
  return `${next.level} seviyesinde ${next.target - next.known} kelime daha yakalarsan pasaportta bir sonraki eşiğe yaklaşacaksın.`
}
