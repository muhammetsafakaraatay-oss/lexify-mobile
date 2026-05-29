import { callLLM } from './ai/llmClient'
import type { ReadingHistoryItem, SavedWord } from './data'

export interface WrappedCard {
  id: string
  eyebrow: string
  title: string
  body: string
  accent?: string
}

export interface WeeklyWrappedPayload {
  cards: WrappedCard[]
  shareText: string
}

function startOfWeek(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay() || 7
  copy.setHours(0, 0, 0, 0)
  copy.setDate(copy.getDate() - (day - 1))
  return copy
}

function sameOrAfter(dateString: string | undefined | null, pivot: Date) {
  if (!dateString) return false
  return new Date(dateString).getTime() >= pivot.getTime()
}

function favoriteTopic(words: SavedWord[]) {
  const counts = new Map<string, number>()
  words.forEach((word) => {
    ;(word.topic_tags || []).forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    })
  })
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  return ranked[0] || null
}

function hardestWord(words: SavedWord[]) {
  return [...words]
    .sort((a, b) => {
      const aScore = (a.lapses || 0) * 3 + (a.repetitions || 0)
      const bScore = (b.lapses || 0) * 3 + (b.repetitions || 0)
      return bScore - aScore
    })[0] || null
}

function levelProgress(words: SavedWord[]) {
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const counts = new Map<string, number>()
  words.forEach((word) => {
    const level = word.cefr_level || word.cefr
    if (level) counts.set(level, (counts.get(level) || 0) + 1)
  })
  const current = order
    .slice()
    .reverse()
    .find((level) => (counts.get(level) || 0) > 0) || 'A1'
  const currentCount = counts.get(current) || 0
  const progressPct = Math.min(100, Math.round((currentCount / 25) * 100))
  return { current, progressPct }
}

function computeStreakDays(words: SavedWord[]) {
  const dates = new Set(
    words
      .map((word) => String(word.saved_at || word.created_at || '').slice(0, 10))
      .filter(Boolean),
  )
  let streak = 0
  const cursor = new Date()
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export async function buildWeeklyWrapped(params: {
  savedWords: SavedWord[]
  readingHistory: ReadingHistoryItem[]
  userId?: string
  isPro?: boolean
}): Promise<WeeklyWrappedPayload | null> {
  const weekStart = startOfWeek()
  const weeklyWords = params.savedWords.filter((word) =>
    sameOrAfter(word.saved_at || word.created_at, weekStart),
  )
  const weeklyReads = params.readingHistory.filter((item) => sameOrAfter(item.created_at, weekStart))

  if (weeklyWords.length < 3 && weeklyReads.length === 0) return null

  const topic = favoriteTopic(weeklyWords.length ? weeklyWords : params.savedWords)
  const hard = hardestWord(params.savedWords)
  const progress = levelProgress(params.savedWords)
  const streak = computeStreakDays(params.savedWords)
  const totalReviews = params.savedWords.reduce((sum, word) => sum + (word.repetitions || 0), 0)

  let summaryLine = 'Bu hafta gerçek içerikten kelime toplamaya devam ettin. Küçük tekrarlar birleşip güçlü bir ritim oluşturuyor.'
  try {
    const response = await callLLM({
      feature: 'wrapped',
      model: 'gpt-4o-mini',
      userId: params.userId,
      isPro: params.isPro,
      cacheKey: `wrapped:${weekStart.toISOString().slice(0, 10)}:${weeklyWords.length}:${weeklyReads.length}`,
      cacheTTL: 60 * 60 * 24 * 7,
      maxRetries: 1,
      messages: [
        {
          role: 'system',
          content: 'Kullanıcının haftasını sıcak, motive edici, tek cümlelik Türkçe bir özetle anlat. Sadece tek cümle dön.',
        },
        {
          role: 'user',
          content: `Words saved: ${weeklyWords.length}\nReading sessions: ${weeklyReads.length}\nTop topic: ${topic?.[0] || 'general'}\nStreak: ${streak}`,
        },
      ],
    })
    if (response.content?.trim()) summaryLine = response.content.trim()
  } catch {
    // fallback
  }

  const cards: WrappedCard[] = [
    {
      id: 'welcome',
      eyebrow: 'BU HAFTA',
      title: 'Lexfly haftan hazır',
      body: summaryLine,
      accent: '#facc15',
    },
    {
      id: 'numbers',
      eyebrow: 'SAYILAR',
      title: `${weeklyWords.length} kelime kaydettin`,
      body: `${weeklyReads.length} okuma oturumu ve toplam ${totalReviews} tekrar ile bu haftayı boş geçmedin.`,
      accent: '#60a5fa',
    },
    {
      id: 'topic',
      eyebrow: 'TEMAN',
      title: topic ? `En çok ${topic[0]} okudun` : 'Tema topluyorsun',
      body: topic
        ? `Bu hafta kaydettiğin kelimelerin ${topic[1]} tanesi ${topic[0]} temasından geldi.`
        : 'Biraz daha veriyle gelecek hafta favori temanı daha net göstereceğim.',
      accent: '#4ade80',
    },
    {
      id: 'hardest',
      eyebrow: 'YILDIZ KELİME',
      title: hard ? hard.word : 'Yeni favorin yolda',
      body: hard
        ? `${hard.word} kelimesi seni en çok uğraştıran ama en çok iz bırakanlardan biri olmuş.`
        : 'Henüz öne çıkan bir zorluk kelimesi görünmüyor.',
      accent: '#fb923c',
    },
    {
      id: 'progress',
      eyebrow: 'SEVİYE',
      title: `${progress.current} içinde %${progress.progressPct}`,
      body: `Şu an ${progress.current} seviyesindeki kelimelerde görünür bir birikim oluşuyor.`,
      accent: '#e879f9',
    },
    {
      id: 'streak',
      eyebrow: 'TUTARLILIK',
      title: streak > 0 ? `${streak} günlük seri` : 'Seri yeniden başlar',
      body: streak > 0
        ? 'En güçlü öğrenme sinyalin süreklilik. Bu ritmi korursan kelimeler daha çabuk oturur.'
        : 'Yarın kısa bir okuma ile yeni seriyi başlatabilirsin.',
      accent: '#f87171',
    },
  ]

  if (params.isPro) {
    cards.push({
      id: 'pro-focus',
      eyebrow: 'GELECEK HAFTA',
      title: topic ? `${topic[0]} üstünden büyü` : 'Okuma ritmini koru',
      body: topic
        ? `Gelecek hafta ${topic[0]} temasında 3 yeni kelime yakalayabilirsen seviyen daha hızlı oturacak.`
        : 'Bir tema etrafında iki gün üst üste okuma yapmak ilerlemeyi belirginleştirir.',
      accent: '#facc15',
    })
  }

  const shareText = `Bu hafta Lexfly'da ${weeklyWords.length} kelime kaydettim, ${weeklyReads.length} okuma yaptım ve ${streak} günlük seri yakaladım.`

  return { cards, shareText }
}
