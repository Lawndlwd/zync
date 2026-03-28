import { logger } from '../../lib/logger.js'
import { getOrCreateSession } from '../../opencode/client.js'
import { waitForResponse } from '../../opencode/wait-for-response.js'

export interface NewsItem {
  title: string
  url: string
  source: string
  topic: string
}

const SESSION_PURPOSE = 'widget-news'

export async function fetchNews(topics: string[]): Promise<NewsItem[]> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const today = new Date().toISOString().split('T')[0]
  const prompt = `Today is ${today}. Give me 3 news headlines for: ${topics.join(', ')}.

You may use WebFetch ONCE to get headlines. No other tools — no Bash, no Read, no Grep, no Glob, no Agent, no Skill, no Edit, no Write. Maximum 1 WebFetch call, then immediately return the JSON.

Return ONLY this JSON array:
[{"title":"...","url":"https://...","source":"...","topic":"..."}]`

  const response = await waitForResponse(sessionId, prompt, { timeoutMs: 30_000 })

  logger.info({ responseLength: response.length, preview: response.slice(0, 500) }, 'News LLM response')

  if (!response?.trim()) {
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
