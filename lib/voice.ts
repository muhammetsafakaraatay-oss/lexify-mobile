import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SavedWord } from './data'

const VOICE_DRAFT_KEY = 'voice_echo_draft_v1'
const VOICE_SESSIONS_KEY = 'voice_echo_sessions_v1'
const VOICE_FREE_WEEKLY_KEY = 'voice_echo_free_weekly_v1'
const VOICE_PRO_DAILY_KEY = 'voice_echo_pro_daily_v1'

const FALLBACK_TARGET_WORDS = ['opportunity', 'deliberate', 'fortunate', 'commute']

const PROMPT_TEMPLATES = [
  'Su 4 kelimeyi kullanarak bugunun en dikkat cekici anini 30 saniyede anlat:',
  'Bu kelimelerle arkadasina kahve molasinda neler oldugunu anlat:',
  'Kisa bir gun ozeti yap ve bu kelimeleri dogal sekilde kullan:',
  'Bu kelimelerle is, okul veya yolculuk temali mini bir hikaye kur:',
  'Bu kelimeleri kullanarak bugunun planini veya dunu ozetle:',
] as const

export interface VoiceWordTiming {
  word: string
  start: number
  end: number
  confidence?: number
}

export interface VoiceScores {
  word_usage: number
  grammar: number
  fluency: number
  relevance: number
  total: number
}

export interface VoiceWordChecklistItem {
  word: string
  used: boolean
  natural: boolean | null
  context: string | null
  confidence?: number
}

export interface VoiceGrammarIssue {
  original: string
  correction: string
  rule: string
}

export interface VoiceFeedback {
  word_checklist: VoiceWordChecklistItem[]
  grammar_issues: VoiceGrammarIssue[]
  feedback_tr: string
  encouragement_tr: string
}

export interface VoiceSession {
  id: string
  status: 'completed' | 'failed' | 'cancelled'
  targetWords: string[]
  promptText: string
  audioUri?: string
  audioDurationMs?: number
  audioSizeBytes?: number
  transcript?: string
  transcriptWordTimings?: VoiceWordTiming[]
  detectedLanguage?: string
  scores?: VoiceScores
  feedback?: VoiceFeedback
  wordsPerMinute?: number
  processingLatencyMs?: {
    transcribe: number
    analyze: number
    total: number
  }
  createdAt: string
  completedAt?: string
  errorMessage?: string
  isProSession?: boolean
}

export interface VoiceDraft {
  targetWords: string[]
  promptText: string
  audioUri?: string
  audioDurationMs?: number
  audioSizeBytes?: number
  createdAt: string
}

interface VoiceQuotaState {
  used: number
  limit: number
  canRecord: boolean
  resetLabel: string
}

function todayKey(date = new Date()) {
  return date.toISOString().split('T')[0]
}

function weekKey(date = new Date()) {
  const copy = new Date(date)
  const day = (copy.getDay() + 6) % 7
  copy.setHours(12, 0, 0, 0)
  copy.setDate(copy.getDate() - day)
  return todayKey(copy)
}

function nextTuesdayLabel(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay()
  const daysUntilTuesday = (2 - day + 7) % 7 || 7
  copy.setDate(copy.getDate() + daysUntilTuesday)
  return copy.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
}

async function readMap(key: string): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

async function writeMap(key: string, value: Record<string, number>) {
  await AsyncStorage.setItem(key, JSON.stringify(value))
}

function normalizeTargetWords(words: string[]) {
  return words
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 5)
}

export function buildVoicePrompt(words: SavedWord[]): { targetWords: string[]; promptText: string } {
  const picked = normalizeTargetWords(
    words
      .filter((word) => word.stage !== 'mastered')
      .sort((a, b) => (a.repetitions ?? 0) - (b.repetitions ?? 0))
      .map((word) => word.word)
      .slice(0, 4),
  )

  const targetWords = picked.length >= 3 ? picked : FALLBACK_TARGET_WORDS
  const template = PROMPT_TEMPLATES[Math.floor(Date.now() / 1000 / 60) % PROMPT_TEMPLATES.length]
  return {
    targetWords,
    promptText: `${template} ${targetWords.join(', ')}`,
  }
}

export async function saveVoiceDraft(draft: VoiceDraft) {
  await AsyncStorage.setItem(VOICE_DRAFT_KEY, JSON.stringify(draft))
}

export async function getVoiceDraft(): Promise<VoiceDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as VoiceDraft) : null
  } catch {
    return null
  }
}

export async function updateVoiceDraft(patch: Partial<VoiceDraft>) {
  const current = await getVoiceDraft()
  if (!current) return
  await saveVoiceDraft({ ...current, ...patch })
}

export async function clearVoiceDraft() {
  await AsyncStorage.removeItem(VOICE_DRAFT_KEY)
}

export async function listVoiceSessions(): Promise<VoiceSession[]> {
  try {
    const raw = await AsyncStorage.getItem(VOICE_SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VoiceSession[]) : []
  } catch {
    return []
  }
}

export async function getVoiceSession(id: string): Promise<VoiceSession | null> {
  const sessions = await listVoiceSessions()
  return sessions.find((session) => session.id === id) ?? null
}

export async function saveVoiceSession(session: VoiceSession) {
  const sessions = await listVoiceSessions()
  const next = [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 50)
  await AsyncStorage.setItem(VOICE_SESSIONS_KEY, JSON.stringify(next))
}

export async function getVoiceQuota(isPro: boolean): Promise<VoiceQuotaState> {
  if (isPro) {
    const key = todayKey()
    const map = await readMap(VOICE_PRO_DAILY_KEY)
    const used = map[key] ?? 0
    return {
      used,
      limit: 1,
      canRecord: used < 1,
      resetLabel: 'yarin yenilenir',
    }
  }

  const key = weekKey()
  const map = await readMap(VOICE_FREE_WEEKLY_KEY)
  const used = map[key] ?? 0
  return {
    used,
    limit: 1,
    canRecord: used < 1,
    resetLabel: `${nextTuesdayLabel()} yenilenir`,
  }
}

export async function consumeVoiceQuota(isPro: boolean) {
  const storageKey = isPro ? VOICE_PRO_DAILY_KEY : VOICE_FREE_WEEKLY_KEY
  const mapKey = isPro ? todayKey() : weekKey()
  const map = await readMap(storageKey)
  map[mapKey] = (map[mapKey] ?? 0) + 1
  await writeMap(storageKey, map)
}
