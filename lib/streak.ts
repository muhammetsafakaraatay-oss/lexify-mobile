import { supabase } from './supabase'
import { getPreferences } from './preferences'

export interface DailyActivity {
  day: string
  reviewsDone: number
  wordsAdded: number
  goalMet: boolean
}

export interface StreakInfo {
  current: number
  longest: number
  todayMet: boolean
  yesterdayMet: boolean
  daysUntilLost: number
}

export function computeStreak(activities: DailyActivity[], today: string): StreakInfo {
  if (activities.length === 0) {
    return { current: 0, longest: 0, todayMet: false, yesterdayMet: false, daysUntilLost: 1 }
  }

  const byDay: Record<string, DailyActivity> = {}
  for (const a of activities) {
    byDay[a.day] = a
  }

  const todayMet = byDay[today]?.goalMet ?? false

  const yesterday = offsetDay(today, -1)
  const yesterdayMet = byDay[yesterday]?.goalMet ?? false

  function offsetDay(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().split('T')[0]
  }

  let current = 0
  let longest = 0
  let runLen = 0

  const allDays = Object.keys(byDay).sort()

  let streakCheckStart = todayMet ? today : yesterday

  let checkDate = streakCheckStart
  while (true) {
    if (byDay[checkDate]?.goalMet) {
      current++
      checkDate = offsetDay(checkDate, -1)
    } else {
      break
    }
  }

  let runDate = allDays[0]
  while (runDate <= today) {
    if (byDay[runDate]?.goalMet) {
      runLen++
      if (runLen > longest) longest = runLen
    } else {
      runLen = 0
    }
    runDate = offsetDay(runDate, 1)
  }

  if (current > longest) longest = current

  const daysUntilLost = todayMet ? 2 : 1

  return { current, longest, todayMet, yesterdayMet, daysUntilLost }
}

export async function recordActivity(delta: {
  reviewsDelta?: number
  wordsAddedDelta?: number
  readingMinutesDelta?: number
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const today = new Date().toISOString().split('T')[0]

  const { data: existing, error: fetchError } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('user_id', user.id)
    .eq('day', today)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('[streak] recordActivity fetch error:', fetchError.message)
    return
  }

  const prefs = await getPreferences()
  const dailyGoal = prefs?.dailyGoal ?? 10

  const prevReviews = (existing?.reviews_done as number) ?? 0
  const prevWords = (existing?.words_added as number) ?? 0
  const prevReading = (existing?.reading_minutes as number) ?? 0

  const newReviews = prevReviews + (delta.reviewsDelta ?? 0)
  const newWords = prevWords + (delta.wordsAddedDelta ?? 0)
  const newReading = prevReading + (delta.readingMinutesDelta ?? 0)
  const goalMet = newReviews >= dailyGoal || newWords >= dailyGoal

  const { error } = await supabase
    .from('daily_activity')
    .upsert({
      user_id: user.id,
      day: today,
      reviews_done: newReviews,
      words_added: newWords,
      reading_minutes: newReading,
      goal_met: goalMet,
    }, { onConflict: 'user_id,day' })

  if (error) {
    console.error('[streak] recordActivity upsert error:', error.message)
  }
}

export async function getRecentActivity(days: number): Promise<DailyActivity[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('daily_activity')
    .select('*')
    .eq('user_id', user.id)
    .gte('day', since)
    .order('day', { ascending: false })

  if (error) {
    console.error('[streak] getRecentActivity error:', error.message)
    return []
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    day: row.day as string,
    reviewsDone: (row.reviews_done as number) ?? 0,
    wordsAdded: (row.words_added as number) ?? 0,
    goalMet: (row.goal_met as boolean) ?? false,
  }))
}
