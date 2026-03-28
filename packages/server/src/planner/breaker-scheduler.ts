import { getChannelManager } from '../channels/manager.js'
import type { ChannelType } from '../channels/types.js'
import { getConfig } from '../config/index.js'
import { logger } from '../lib/logger.js'
import { awardXp, getAutopilotBreakers, getJournalEntry, upsertJournalEntry } from './db.js'

// Track which breakers have been sent today to avoid duplicates
const sentToday = new Set<string>()
let lastResetDate = ''

// Map: telegram message ID → { question, breakerId, date }
// So we can recognize replies to breaker messages
const pendingBreakers = new Map<string, { question: string; breakerId: string; date: string }>()

function resetIfNewDay() {
  const today = new Date().toISOString().slice(0, 10)
  if (today !== lastResetDate) {
    sentToday.clear()
    pendingBreakers.clear()
    lastResetDate = today
  }
}

function getChannel(): ChannelType {
  return (getConfig('BRIEFING_CHANNEL') || getConfig('DEFAULT_CHANNEL') || 'telegram') as ChannelType
}

function getChatId(): string {
  return getConfig('BRIEFING_CHAT_ID') || getConfig('DEFAULT_CHAT_ID') || ''
}

async function checkBreakers() {
  resetIfNewDay()

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const breakers = getAutopilotBreakers() as { id: string; time: string; question: string; enabled: number }[]
  const chatId = getChatId()
  if (!chatId) return

  for (const breaker of breakers) {
    if (!breaker.enabled) continue
    if (breaker.time !== currentTime) continue
    if (sentToday.has(breaker.id)) continue

    sentToday.add(breaker.id)

    try {
      const manager = getChannelManager()
      const channel = getChannel()
      const adapter = manager.getAdapter(channel)
      if (!adapter) {
        logger.warn({ channel }, 'Breaker scheduler: no adapter for channel')
        continue
      }

      // Send via channel manager's underlying bot to get the message ID back
      const text = `🔔 Autopilot Breaker\n\n${breaker.question}\n\nReply to this message with your reflection.`

      if (channel === 'telegram') {
        const bot = (adapter as any).getBotInstance()
        const sent = await bot.api.sendMessage(chatId, text)
        // Track this message so we can intercept the reply
        pendingBreakers.set(String(sent.message_id), {
          question: breaker.question,
          breakerId: breaker.id,
          date: now.toISOString().slice(0, 10),
        })
        logger.info({ time: breaker.time, messageId: sent.message_id }, 'Autopilot breaker sent')
      } else {
        await manager.send(channel, chatId, { text })
        logger.info({ time: breaker.time }, 'Autopilot breaker sent (no reply tracking)')
      }
    } catch (err) {
      logger.error({ err, breakerId: breaker.id }, 'Failed to send autopilot breaker')
    }
  }
}

/**
 * Check if an incoming message is a reply to a breaker.
 * If so, save the journal entry + award XP and return true.
 * The caller should skip normal AI processing.
 */
export function handleBreakerReply(replyToMessageId: string | undefined, responseText: string): boolean {
  if (!replyToMessageId) return false

  const breaker = pendingBreakers.get(replyToMessageId)
  if (!breaker) return false

  // Save as journal entry
  try {
    const responses = [{ question: breaker.question, answer: responseText }]

    // Check if there's already a breaker journal for today — append to it
    const existing = getJournalEntry(breaker.date, 'breaker') as
      | {
          id: string
          responses: string
        }
      | undefined

    if (existing) {
      const prev = JSON.parse(existing.responses || '[]')
      prev.push(...responses)
      upsertJournalEntry(breaker.date, 'breaker', prev, {
        completedAt: new Date().toISOString(),
      })
    } else {
      upsertJournalEntry(breaker.date, 'breaker', responses, {
        completedAt: new Date().toISOString(),
      })
    }

    awardXp('breaker_answered', 50, `Answered: ${breaker.question}`, breaker.date)
    pendingBreakers.delete(replyToMessageId)

    logger.info({ breakerId: breaker.breakerId, question: breaker.question }, 'Breaker reply saved as journal entry')
    return true
  } catch (err) {
    logger.error({ err }, 'Failed to save breaker reply')
    return false
  }
}

/** Send a breaker immediately (for testing). Returns the question sent. */
export async function sendTestBreaker(): Promise<string | null> {
  const chatId = getChatId()
  if (!chatId) return null

  const breakers = getAutopilotBreakers() as { id: string; question: string; enabled: number }[]
  const enabled = breakers.filter((b) => b.enabled)
  if (enabled.length === 0) return null

  const breaker = enabled[Math.floor(Math.random() * enabled.length)]
  const channel = getChannel()
  const manager = getChannelManager()
  const adapter = manager.getAdapter(channel)
  if (!adapter) return null

  const text = `🔔 Autopilot Breaker\n\n${breaker.question}\n\nReply to this message with your reflection.`
  const today = new Date().toISOString().slice(0, 10)

  if (channel === 'telegram') {
    const bot = (adapter as any).getBotInstance()
    const sent = await bot.api.sendMessage(chatId, text)
    pendingBreakers.set(String(sent.message_id), {
      question: breaker.question,
      breakerId: breaker.id,
      date: today,
    })
    return breaker.question
  }

  await manager.send(channel, chatId, { text })
  return breaker.question
}

let intervalId: ReturnType<typeof setInterval> | null = null

export function startBreakerScheduler() {
  if (intervalId) return
  intervalId = setInterval(checkBreakers, 60_000) // Check every minute
  logger.info('Autopilot breaker scheduler started (checking every 60s)')
}

export function stopBreakerScheduler() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}
