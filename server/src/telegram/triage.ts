import { getOrCreateSession } from '../opencode/client.js'
import { waitForResponse } from '../opencode/wait-for-response.js'
import { insertLLMCall, extractUsageFromSession } from '../bot/memory/activity.js'
import { loadPromptContent } from '../skills/prompts.js'
import { insertDM } from './db.js'
import { isRateLimited } from './rate-limit.js'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'
import type { Bot } from 'grammy'

const CATEGORIES = ['urgent', 'business', 'support', 'spam', 'fan'] as const
type DMCategory = (typeof CATEGORIES)[number]

function getSupportPrompt(): string {
  try {
    return loadPromptContent('telegram-support')
  } catch {
    return 'You are a helpful assistant. Respond in the user\'s language. Be concise.'
  }
}

async function classifyMessage(text: string): Promise<DMCategory> {
  const sessionId = await getOrCreateSession('telegram-dm')
  const prompt = [
    'Classify this Telegram DM into exactly one category.',
    `Categories: ${CATEGORIES.join(', ')}`,
    '',
    `Message: "${text}"`,
    '',
    'Respond with ONLY the category name, nothing else.',
  ].join('\n')

  const result = await waitForResponse(sessionId, prompt, { timeoutMs: 15_000 })
  const category = result.trim().toLowerCase() as DMCategory
  return CATEGORIES.includes(category) ? category : 'support'
}

async function generateReply(senderName: string, text: string): Promise<string> {
  const sessionId = await getOrCreateSession('telegram-dm')
  const prompt = getSupportPrompt()

  const fullPrompt = [
    prompt,
    '',
    `DM from ${senderName}: "${text}"`,
    '',
    'Reply:',
  ].join('\n')

  return waitForResponse(sessionId, fullPrompt, { timeoutMs: 30_000 })
}

export async function handleTelegramDM(
  bot: Bot,
  businessConnectionId: string,
  chatId: string,
  senderId: string,
  senderName: string,
  username: string | undefined,
  text: string,
): Promise<void> {
  if (isRateLimited(senderId)) {
    logger.warn({ senderId }, 'Telegram DM triage: rate limited')
    return
  }

  const startTime = Date.now()

  try {
    // Always classify
    const category = await classifyMessage(text)

    const autoReplyEnabled = getConfig('TELEGRAM_DM_AUTO_REPLY') === 'true'

    if (autoReplyEnabled) {
      const reply = await generateReply(senderName, text)

      // Store DM with reply
      insertDM({
        telegramUserId: senderId,
        username,
        displayName: senderName,
        messageText: text,
        category,
        autoReplied: true,
        replyText: reply,
        businessConnectionId,
      })

      // Send reply via Business Mode
      await bot.api.sendMessage(chatId, reply, {
        business_connection_id: businessConnectionId,
      } as any)

      const sessionId = await getOrCreateSession('telegram-dm')
      const usage = await extractUsageFromSession(sessionId)
      insertLLMCall({
        source: 'telegram-dm',
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
    } else {
      // Store DM without reply (classify only)
      insertDM({
        telegramUserId: senderId,
        username,
        displayName: senderName,
        messageText: text,
        category,
        autoReplied: false,
        businessConnectionId,
      })
    }

    logger.info({ senderId, category, autoReply: autoReplyEnabled }, 'Telegram DM processed')
  } catch (err) {
    // Store even on error, so it shows in dashboard
    insertDM({
      telegramUserId: senderId,
      username,
      displayName: senderName,
      messageText: text,
      category: 'uncategorized',
      autoReplied: false,
      businessConnectionId,
    })
    logger.error({ err, senderId }, 'Telegram DM triage error')
  }
}
