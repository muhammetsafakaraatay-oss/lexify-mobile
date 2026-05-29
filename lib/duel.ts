import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SavedWord } from './data'

const DUEL_PREFIX = 'duels_v1'

export interface DuelQuestion {
  id: string
  word: string
  correct: string
  options: string[]
  cefr?: string
}

export interface DuelChallenge {
  id: string
  createdAt: string
  senderName: string
  message: string
  questions: DuelQuestion[]
  score?: number
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5)
}

function hashText(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

function storageKey(id: string) {
  return `${DUEL_PREFIX}:${id}`
}

export function createDuelChallenge(words: SavedWord[], senderName: string, message: string): DuelChallenge {
  const pool = shuffle(words).slice(0, 5)
  const questions = pool.map((word) => {
    const distractors = shuffle(
      words
        .filter((item) => item.id !== word.id && item.translation)
        .map((item) => item.translation as string),
    )
      .filter((item, index, arr) => arr.indexOf(item) === index)
      .slice(0, 3)

    return {
      id: word.id,
      word: word.word,
      correct: word.translation || '—',
      options: shuffle([word.translation || '—', ...distractors]).slice(0, 4),
      cefr: word.cefr_level || word.cefr,
    }
  })

  return {
    id: `duel-${hashText(`${senderName}:${Date.now()}:${pool.map((item) => item.id).join(',')}`)}`,
    createdAt: new Date().toISOString(),
    senderName,
    message,
    questions,
  }
}

export async function saveDuelChallenge(challenge: DuelChallenge) {
  await AsyncStorage.setItem(storageKey(challenge.id), JSON.stringify(challenge))
}

export async function loadDuelChallenge(id: string): Promise<DuelChallenge | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(id))
    return raw ? (JSON.parse(raw) as DuelChallenge) : null
  } catch {
    return null
  }
}

export function encodeDuelPayload(challenge: DuelChallenge) {
  return encodeURIComponent(JSON.stringify(challenge))
}

export function decodeDuelPayload(payload: string): DuelChallenge | null {
  try {
    return JSON.parse(decodeURIComponent(payload)) as DuelChallenge
  } catch {
    return null
  }
}
