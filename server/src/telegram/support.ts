import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { insertLLMCall, extractUsageFromSession } from '../bot/memory/activity.js'
import { loadPromptContent } from '../skills/prompts.js'
import { isRateLimited } from './rate-limit.js'
import { logger } from '../lib/logger.js'
import type { InboundMessage } from '../channels/types.js'
import { getChannelManager } from '../channels/manager.js'

let supportPrompt: string | null = null

function getSupportPrompt(): string {
  if (!supportPrompt) {
    try {
      supportPrompt = loadPromptContent('telegram-support')
    } catch {
      supportPrompt = 'You are a helpful support assistant. Respond in the user\'s language. Be concise.'
    }
  }
  return supportPrompt
}

/** Reload skill file (called when user edits it) */
export function reloadSupportPrompt(): void {
  supportPrompt = null
}

export async function handleSupportMessage(msg: InboundMessage): Promise<void> {
  const manager = getChannelManager()

  // Rate limit check
  if (isRateLimited(msg.senderId)) {
    logger.warn({ senderId: msg.senderId }, 'Telegram support: rate limited')
    return
  }

  if (!msg.text) return

  const typingInterval = setInterval(() => {
    manager.sendTyping(msg.channelType, msg.chatId).catch(() => {})
  }, 4000)
  await manager.sendTyping(msg.channelType, msg.chatId)

  try {
    const startTime = Date.now()
    const prompt = getSupportPrompt()

    const fullPrompt = [
      prompt,
      '',
      `User (${msg.senderName}): "${msg.text}"`,
      '',
      'Reply:',
    ].join('\n')

    const sessionId = await getOrCreateSession('telegram-support')
    const reply = await waitForResponse(sessionId, fullPrompt, { timeoutMs: 30_000 })

    const usage = await extractUsageFromSession(sessionId)
    insertLLMCall({
      source: 'telegram-support',
      model: usage.model,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      tool_names: [],
      duration_ms: Date.now() - startTime,
      session_id: sessionId,
      message_id: usage.message_id,
      cost: usage.cost,
    })

    await manager.send(msg.channelType, msg.chatId, { text: reply || 'Sorry, I could not process your message.' })
  } catch (err) {
    logger.error({ err, senderId: msg.senderId }, 'Telegram support handler error')
    await manager.send(msg.channelType, msg.chatId, { text: 'Something went wrong. Please try again later.' }).catch(() => {})
  } finally {
    clearInterval(typingInterval)
  }
}
