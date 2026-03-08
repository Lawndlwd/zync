import { getOrCreateSession } from '../../opencode/client.js'
import { waitForResponse } from '../../opencode/wait-for-response.js'
import { logger } from '../../lib/logger.js'

export interface FinanceTip {
  title: string
  insight: string
  category: string
}

const SESSION_PURPOSE = 'widget-finance'

export async function fetchFinanceTips(focus: string[]): Promise<FinanceTip[]> {
  const sessionId = await getOrCreateSession(SESSION_PURPOSE)
  const today = new Date().toISOString().split('T')[0]
  const prompt = `You are a financial advisor assistant. Today is ${today}.

Generate 3-4 actionable financial tips/insights for someone interested in: ${focus.join(', ')}.

Return ONLY a JSON array, no markdown fences:
[{"title": "...", "insight": "...", "category": "..."}]`

  const response = await waitForResponse(sessionId, prompt, { timeoutMs: 60_000 })

  try {
    const match = response.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found')
    return JSON.parse(match[0])
  } catch (err) {
    logger.error({ err, response: response.slice(0, 300) }, 'Failed to parse finance JSON')
    return []
  }
}
