/** "40 min", "2h", "2h10". */
export function durationLabel(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h${String(rest).padStart(2, '0')}` : `${h}h`
}
