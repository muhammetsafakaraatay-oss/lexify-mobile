/**
 * UI-friendly Turkish relative time formatter.
 * Example: "2 dk önce", "3 saat önce", "5 gün önce".
 */
export function timeAgoTr(date: string | number | Date): string {
  const ts = date instanceof Date ? date.getTime() : new Date(date).getTime()
  if (Number.isNaN(ts)) return ''

  const diff = Date.now() - ts
  if (diff < 0) return 'az önce'

  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'az önce'
  if (mins < 60) return `${mins} dk önce`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} saat önce`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} gün önce`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks} hafta önce`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ay önce`

  const years = Math.floor(days / 365)
  return `${years} yıl önce`
}
