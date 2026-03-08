import { getOrCreateSession } from '../../opencode/client.js'
import { waitForResponse } from '../../opencode/wait-for-response.js'
import { logger } from '../../lib/logger.js'

export interface NewsItem {
  headline: string
  summary: string
  topic: string
}

const SESSION_PURPOSE = 'widget-news'

export async function fetchNews(topics: string[]): Promise<NewsItem[]> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const today = new Date().toISOString().split('T')[0]
  const prompt = `You are a news briefing assistant. Today is ${today}.

Generate 4-5 current news headlines with brief 1-sentence summaries for these topics: ${topics.join(', ')}.

Return ONLY a JSON array, no markdown fences:
[{"headline": "...", "summary": "...", "topic": "..."}]`

  const response = await waitForResponse(sessionId, prompt, { timeoutMs: 60_000 })

  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found')
    return JSON.parse(match[0])
  } catch (err) {
    logger.error({ err, response: response.slice(0, 300) }, 'Failed to parse news JSON')
    return []
  }
}
