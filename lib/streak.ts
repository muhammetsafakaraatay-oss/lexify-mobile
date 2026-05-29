/**
 * Kayıt tarihlerinden bugüne doğru kesintisiz aktif gün sayısı.
 */
export function computeStreakFromDates(dates: Array<string | null | undefined>): number {
  const uniqueDays = new Set<string>()
  for (const raw of dates) {
    if (!raw) continue
    const day = raw.split('T')[0]
    if (day) uniqueDays.add(day)
  }
  if (uniqueDays.size === 0) return 0

  const sorted = [...uniqueDays].sort().reverse()
  let streak = 0
  let cursor = new Date().toISOString().split('T')[0]
  for (const day of sorted) {
    if (day === cursor) {
      streak++
      const d = new Date(cursor)
      d.setDate(d.getDate() - 1)
      cursor = d.toISOString().split('T')[0]
    } else if (day < cursor) {
      break
    }
  }
  return streak
}
