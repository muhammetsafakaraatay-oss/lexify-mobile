export function timeAgoTr(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor(diff / 60000)

  if (days > 0) return `${days} gun once`
  if (hours > 0) return `${hours} saat once`
  return `${Math.max(mins, 0)} dk once`
}
