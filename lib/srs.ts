/**
 * Lexify SRS motoru — SM-2 (Anki variant) tabanlı.
 *
 * Saf, side-effect içermeyen fonksiyonlar. Test edilebilir tutuldu.
 *
 * Kelime durumu:
 *  - ease         : SM-2 EF, 1.3 ile 3.0 arasında
 *  - interval     : gün cinsinden bir sonraki review aralığı (0 = relearn / aynı oturumda)
 *  - repetitions  : ardışık doğru cevap sayısı (again ile 0'a iner)
 *  - lapses       : toplam yanlış sayısı (8+ olunca 'leech')
 *  - dueAt        : bir sonraki review zamanı
 *  - stage        : new | learning | review | mastered | leech
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export type Stage = 'new' | 'learning' | 'review' | 'mastered' | 'leech'

export interface SrsState {
  ease: number
  interval: number
  repetitions: number
  lapses: number
  dueAt: Date
  lastReviewedAt: Date | null
  stage: Stage
}

const MIN_EASE = 1.3
const MAX_EASE = 3.0
const RELEARN_MINUTES = 10
const LEECH_THRESHOLD = 8
const MASTER_INTERVAL_DAYS = 30
const MASTER_MAX_LAPSES = 3

const MS_PER_MINUTE = 60 * 1000
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE)
}

/**
 * Bir grade uygulayarak yeni SrsState üretir. State'i mutasyona uğratmaz.
 */
export function applyGrade(state: SrsState, grade: Grade, now: Date = new Date()): SrsState {
  let { ease, interval, repetitions, lapses } = state
  let dueAt: Date

  switch (grade) {
    case 'again': {
      repetitions = 0
      interval = 0
      lapses += 1
      ease = clamp(ease - 0.2, MIN_EASE, MAX_EASE)
      dueAt = addMinutes(now, RELEARN_MINUTES)
      break
    }

    case 'hard': {
      ease = clamp(ease - 0.15, MIN_EASE, MAX_EASE)
      if (repetitions === 0 && interval === 0) {
        interval = 1
      } else {
        interval = Math.max(1, Math.round(interval * 1.2))
      }
      repetitions += 1
      dueAt = addDays(now, interval)
      break
    }

    case 'good': {
      // ease aynı kalır
      if (repetitions === 0 && interval === 0) {
        interval = 1
      } else if (repetitions === 1) {
        interval = 6
      } else {
        interval = Math.max(1, Math.round(interval * ease))
      }
      repetitions += 1
      dueAt = addDays(now, interval)
      break
    }

    case 'easy': {
      ease = clamp(ease + 0.15, MIN_EASE, MAX_EASE)
      if (repetitions === 0 && interval === 0) {
        interval = 4
      } else if (repetitions === 1) {
        interval = Math.round(6 * 1.3)
      } else {
        interval = Math.max(1, Math.round(interval * ease * 1.3))
      }
      repetitions += 1
      dueAt = addDays(now, interval)
      break
    }
  }

  const stage = computeStage({ ease, interval, repetitions, lapses })

  return {
    ease,
    interval,
    repetitions,
    lapses,
    dueAt,
    lastReviewedAt: now,
    stage,
  }
}

/**
 * Stage'i ease/interval/lapses verilerinden çıkarır.
 * Kuralları:
 *  - lapses ≥ 8                                  → leech
 *  - interval ≥ 30 ve lapses < 3                 → mastered
 *  - interval ≥ 1                                → review
 *  - daha önce görülmüş (reps≥1 veya lapses≥1)   → learning
 *  - aksi                                        → new
 */
export function computeStage(input: {
  ease: number
  interval: number
  repetitions: number
  lapses: number
}): Stage {
  if (input.lapses >= LEECH_THRESHOLD) return 'leech'
  if (input.interval >= MASTER_INTERVAL_DAYS && input.lapses < MASTER_MAX_LAPSES) return 'mastered'
  if (input.interval >= 1) return 'review'
  if (input.repetitions >= 1 || input.lapses >= 1) return 'learning'
  return 'new'
}

/**
 * Bir kelimenin şu an gözden geçirilmesi gerekip gerekmediği.
 */
export function isDue(state: SrsState, now: Date = new Date()): boolean {
  return state.dueAt.getTime() <= now.getTime()
}

/**
 * Bir sonraki review için Türkçe insan-dostu etiket döndürür.
 * Örn: "10 dk", "1 sa", "1 gün", "2 hafta", "3 ay".
 */
export function nextDueLabel(state: SrsState, now: Date = new Date()): string {
  const diffMs = state.dueAt.getTime() - now.getTime()
  return formatDurationTr(diffMs)
}

/**
 * Belirli bir grade'in vereceği aralığı önceden hesaplayıp etiket döndürür.
 * UI'da butonların altında gösterilen "10dk · 1g · 4g · 12g" preview'u için.
 */
export function previewGradeLabel(state: SrsState, grade: Grade, now: Date = new Date()): string {
  const next = applyGrade(state, grade, now)
  return nextDueLabel(next, now)
}

function formatDurationTr(diffMs: number): string {
  if (diffMs <= 0) return 'şimdi'

  const minutes = Math.round(diffMs / MS_PER_MINUTE)
  if (minutes < 60) return `${Math.max(1, minutes)} dk`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} sa`

  const days = Math.round(hours / 24)
  if (days < 14) return `${days} gün`

  const weeks = Math.round(days / 7)
  if (weeks < 9) return `${weeks} hafta`

  const months = Math.round(days / 30)
  if (months < 18) return `${months} ay`

  const years = Math.round(days / 365)
  return `${years} yıl`
}

/**
 * Sıfırdan yeni bir kart için varsayılan state.
 */
export function initialState(now: Date = new Date()): SrsState {
  return {
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: now,
    lastReviewedAt: null,
    stage: 'new',
  }
}
