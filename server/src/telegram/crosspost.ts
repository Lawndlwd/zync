import { Bot } from 'grammy'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'
import { getSecret } from '../secrets/index.js'
import { trackChannelPost } from './analytics.js'

export async function crossPostToTelegram(content: string, mediaUrl?: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const channelId = getConfig('TELEGRAM_CHANNEL_ID')
  const botToken = getSecret('CHANNEL_TELEGRAM_BOT_TOKEN')

  if (!channelId || !botToken) {
    return { ok: false, error: 'Telegram channel ID or bot token not configured' }
  }

  const bot = new Bot(botToken)

  try {
    let messageId: string

    if (mediaUrl) {
      const result = await bot.api.sendPhoto(channelId, mediaUrl, {
        caption: content,
      })
      messageId = String(result.message_id)
    } else {
      const result = await bot.api.sendMessage(channelId, content)
      messageId = String(result.message_id)
    }

    trackChannelPost(messageId, content, mediaUrl)
    logger.info({ channelId, messageId }, 'Cross-posted to Telegram channel')

    return { ok: true, messageId }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    logger.error({ err, channelId }, 'Telegram cross-post failed')
    return { ok: false, error: errorMsg }
  }
}
