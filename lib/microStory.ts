import AsyncStorage from '@react-native-async-storage/async-storage'
import { callLLM } from './ai/llmClient'
import type { SavedWord } from './data'

const STORY_KEY_PREFIX = 'micro_story_v1:'

export interface MicroStory {
  id: string
  createdAt: string
  title: string
  story: string
  summaryTr: string
  words: string[]
}

function getWeekKey(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay() || 7
  copy.setHours(12, 0, 0, 0)
  copy.setDate(copy.getDate() + 4 - day)
  const yearStart = new Date(copy.getFullYear(), 0, 1)
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${copy.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function storyKey(userId: string, weekKey: string) {
  return `${STORY_KEY_PREFIX}${userId}:${weekKey}`
}

function hashText(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

function fallbackStory(words: string[]): MicroStory {
  const selected = words.slice(0, 6)
  const story = `On Sunday morning, Elif opened a small notebook and wrote down a new ${selected[0] || 'word'}. During the day, she noticed how one ${selected[1] || 'idea'} led to another, and her confidence grew. By evening, the ${selected[2] || 'lesson'} felt less abstract because it had appeared in a real story, a real video, and a real conversation. That quiet repetition gave her a sense of ${selected[3] || 'progress'}, and the habit finally started to feel natural.`
  return {
    id: `story-${hashText(selected.join(','))}`,
    createdAt: new Date().toISOString(),
    title: 'Bu Haftanın Mikro Hikayesi',
    story,
    summaryTr: 'Bu hafta öğrendiğin kelimeler küçük bir hikâyede birleşti. Amaç, kelimeleri liste gibi değil bağlam içinde yeniden görmek.',
    words: selected,
  }
}

export async function loadMicroStoryArchive(userId: string): Promise<MicroStory[]> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const storyKeys = keys.filter((key) => key.startsWith(`${STORY_KEY_PREFIX}${userId}:`))
    const pairs = await AsyncStorage.multiGet(storyKeys)
    return pairs
      .map(([, value]) => {
        try {
          return value ? (JSON.parse(value) as MicroStory) : null
        } catch {
          return null
        }
      })
      .filter(Boolean)
      .sort((a, b) => (b!.createdAt).localeCompare(a!.createdAt)) as MicroStory[]
  } catch {
    return []
  }
}

export async function getOrCreateWeeklyMicroStory(params: {
  savedWords: SavedWord[]
  userId: string
  isPro?: boolean
}): Promise<MicroStory> {
  const weekKey = getWeekKey()
  const key = storyKey(params.userId, weekKey)
  try {
    const existing = await AsyncStorage.getItem(key)
    if (existing) return JSON.parse(existing) as MicroStory
  } catch {
    // ignore
  }

  const sourceWords = params.savedWords
    .sort((a, b) => String(b.saved_at || b.created_at || '').localeCompare(String(a.saved_at || a.created_at || '')))
    .map((item) => item.word)
    .filter(Boolean)
    .slice(0, 8)

  let story = fallbackStory(sourceWords)
  if (sourceWords.length >= 3) {
    try {
      const response = await callLLM({
        feature: 'micro_story',
        model: 'gpt-4o-mini',
        userId: params.userId,
        isPro: params.isPro,
        cacheKey: `micro-story:${weekKey}:${hashText(sourceWords.join(','))}`,
        cacheTTL: 60 * 60 * 24 * 7,
        maxRetries: 1,
        messages: [
          {
            role: 'system',
            content:
              '80-120 kelimelik İngilizce bir mikro hikâye ve kısa Türkçe özet üret. Verilen kelimeleri doğal biçimde kullan. Sadece JSON dön: {"title":"...","story":"...","summaryTr":"..."}',
          },
          {
            role: 'user',
            content: `Words: ${sourceWords.join(', ')}`,
          },
        ],
      })
      const parsed = JSON.parse(response.content)
      if (parsed?.story) {
        story = {
          id: `story-${weekKey}-${hashText(sourceWords.join(','))}`,
          createdAt: new Date().toISOString(),
          title: String(parsed?.title || 'Bu Haftanın Mikro Hikayesi'),
          story: String(parsed.story),
          summaryTr: String(parsed?.summaryTr || ''),
          words: sourceWords,
        }
      }
    } catch {
      // fallback
    }
  }

  await AsyncStorage.setItem(key, JSON.stringify(story))
  return story
}
