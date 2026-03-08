import { Bot } from 'grammy'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'
import { getSecret } from '../secrets/index.js'
import { upsertPost } from '../social/db.js'

function getChannelId(): string | null {
  return getConfig('TELEGRAM_CHANNEL_ID') || null
}

function getBotToken(): string | null {
  return getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || null
}

export async function fetchTelegramChannelPosts(): Promise<void> {
  const channelId = getChannelId()
  const botToken = getBotToken()
  if (!channelId || !botToken) {
    logger.info('Telegram analytics: no channel ID or bot token configured')
    return
  }

  const bot = new Bot(botToken)

  try {
    const chat = await bot.api.getChat(channelId)
    const memberCount = await bot.api.getChatMemberCount(channelId)
    const channelTitle = 'title' in chat ? chat.title : 'Telegram Channel'

    logger.info({ channelId, memberCount, title: channelTitle }, 'Telegram channel info fetched')
  } catch (err) {
    logger.error({ err, channelId }, 'Telegram channel fetch failed')
  }
}

export function trackChannelPost(externalId: string, content: string, mediaUrl?: string): void {
  try {
    upsertPost({
      platform: 'telegram',
      external_id: externalId,
      content,
      media_url: mediaUrl ?? null,
      posted_at: new Date().toISOString(),
      status: 'published',
    })
  } catch (err) {
    logger.error({ err }, 'Failed to track channel post')
  }
}
