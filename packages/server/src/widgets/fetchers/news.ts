import { getOrCreateSession } from '../../opencode/client.js'
import { waitForResponse } from '../../opencode/wait-for-response.js'
import { logger } from '../../lib/logger.js'

export interface NewsItem {
  title: string
  source: string
  topic: string
}

const SESSION_PURPOSE = 'widget-news'

export async function fetchNews(topics: string[]): Promise<NewsItem[]> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const today = new Date().toISOString().split('T')[0]
  const prompt = `Today is ${today}. Give me exactly 3 of the most trending/watched news headlines right now for: ${topics.join(', ')}.

Rules:
- Only the top 3 most important/viral stories
- Each title must be under 60 characters
- Source = the main outlet covering it
- No explanations, no summaries, just the headlines

Return ONLY a JSON array:
[{"title":"...","source":"...","topic":"..."}]`

  const response = await waitForResponse(sessionId, prompt, { timeoutMs: 60_000 })

  logger.info({ responseLength: response.length, preview: response.slice(0, 500) }, 'News LLM response')

  if (!response || !response.trim()) {
    logger.error('News LLM returned empty response')
    return []
  }

  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found in response')
    const items = JSON.parse(match[0])
    logger.info({ itemCount: items.length }, 'News parsed successfully')
    return items.slice(0, 3)
  } catch (err) {
    logger.error({ err, response: response.slice(0, 500) }, 'Failed to parse news JSON')
    return []
  }
}
