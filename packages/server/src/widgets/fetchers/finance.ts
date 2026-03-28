import { logger } from '../../lib/logger.js'
import { getOrCreateSession } from '../../opencode/client.js'
import { waitForResponse } from '../../opencode/wait-for-response.js'

export interface FinanceTip {
  title: string
  url: string
  category: string
}

const SESSION_PURPOSE = 'widget-finance'

export async function fetchFinanceTips(focus: string[]): Promise<FinanceTip[]> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const today = new Date().toISOString().split('T')[0]
  const prompt = `Today is ${today}. Give me 3 financial insights for: ${focus.join(', ')}.

You may use WebFetch ONCE to get insights. No other tools — no Bash, no Read, no Grep, no Glob, no Agent, no Skill, no Edit, no Write. Maximum 1 WebFetch call, then immediately return the JSON.

Return ONLY this JSON array:
[{"title":"...","url":"https://...","category":"..."}]`

  const response = await waitForResponse(sessionId, prompt, { timeoutMs: 30_000 })

  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found')
    const items = JSON.parse(match[0])
    return items.slice(0, 3)
  } catch (err) {
    logger.error({ err, response: response.slice(0, 300) }, 'Failed to parse finance JSON')
    return []
  }
}
