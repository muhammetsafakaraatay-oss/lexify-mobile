import { supabase } from './supabase'

export interface UserPreferences {
  cefrLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
  dailyGoal: number
  reminderHour: number | null
  reminderMinute: number | null
  reminderEnabled: boolean
  interests: string[]
  timezone: string | null
  onboardedAt: string | null
}

function toDb(p: Partial<UserPreferences>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (p.cefrLevel !== undefined) row.cefr_level = p.cefrLevel
  if (p.dailyGoal !== undefined) row.daily_goal = p.dailyGoal
  if (p.reminderHour !== undefined) row.reminder_hour = p.reminderHour
  if (p.reminderMinute !== undefined) row.reminder_minute = p.reminderMinute
  if (p.reminderEnabled !== undefined) row.reminder_enabled = p.reminderEnabled
  if (p.interests !== undefined) row.interests = p.interests
  if (p.timezone !== undefined) row.timezone = p.timezone
  if (p.onboardedAt !== undefined) row.onboarded_at = p.onboardedAt
  row.updated_at = new Date().toISOString()
  return row
}

function fromDb(row: Record<string, unknown>): UserPreferences {
  return {
    cefrLevel: (row.cefr_level as UserPreferences['cefrLevel']) ?? undefined,
    dailyGoal: (row.daily_goal as number) ?? 10,
    reminderHour: (row.reminder_hour as number | null) ?? null,
    reminderMinute: (row.reminder_minute as number | null) ?? null,
    reminderEnabled: (row.reminder_enabled as boolean) ?? true,
    interests: (row.interests as string[]) ?? [],
    timezone: (row.timezone as string | null) ?? null,
    onboardedAt: (row.onboarded_at as string | null) ?? null,
  }
}

export async function getPreferences(): Promise<UserPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[preferences] getPreferences error:', error.message)
    }
    return null
  }

  return fromDb(data as Record<string, unknown>)
}

export async function upsertPreferences(p: Partial<UserPreferences>): Promise<UserPreferences | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const row = { user_id: user.id, ...toDb(p) }

  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(row, { onConflict: 'user_id' })
    .select()
    .single()

  if (error) {
    console.error('[preferences] upsertPreferences error:', error.message)
    return null
  }

  return fromDb(data as Record<string, unknown>)
}

export async function isOnboarded(): Promise<boolean> {
  const prefs = await getPreferences()
  return prefs?.onboardedAt != null
}

export async function setPushToken(token: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, push_token: token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) {
    console.error('[preferences] setPushToken error:', error.message)
  }
}
