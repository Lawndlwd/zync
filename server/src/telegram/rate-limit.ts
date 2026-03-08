import { getConfig } from '../config/index.js'

const hits = new Map<string, number[]>()

export function isRateLimited(userId: string): boolean {
  const maxPerMinute = Number(getConfig('TELEGRAM_SUPPORT_RATE_LIMIT', '5')) || 5
  const now = Date.now()
  const windowMs = 60_000

  const userHits = hits.get(userId) ?? []
  const recent = userHits.filter((t) => now - t < windowMs)

  if (recent.length >= maxPerMinute) return true

  recent.push(now)
  hits.set(userId, recent)
  return false
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [userId, timestamps] of hits) {
    const recent = timestamps.filter((t) => now - t < 60_000)
    if (recent.length === 0) hits.delete(userId)
    else hits.set(userId, recent)
  }
}, 5 * 60_000)
