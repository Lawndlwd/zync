import { getOrCreateSession } from '../../opencode/client.js'
import { waitForResponse } from '../../opencode/wait-for-response.js'
import { logger } from '../../lib/logger.js'

export interface FinanceTip {
  title: string
  category: string
}

const SESSION_PURPOSE = 'widget-finance'

export async function fetchFinanceTips(focus: string[]): Promise<FinanceTip[]> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const today = new Date().toISOString().split('T')[0]
  const prompt = `Today is ${today}. Give me exactly 3 of the most trending financial insights right now for: ${focus.join(', ')}.

Rules:
- Only the top 3 most relevant/actionable insights
- Each title must be under 60 characters — short, punchy, like a headline
- No explanations, no paragraphs

Return ONLY a JSON array:
[{"title":"...","category":"..."}]`

  const response = await waitForResponse(sessionId, prompt, { timeoutMs: 60_000 })

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
