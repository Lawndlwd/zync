import { Bot } from 'grammy'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'
import { getSecret } from '../secrets/index.js'
import { getSocialDb } from '../social/db.js'
import { upsertPost, upsertAccount, updateAccountSync, upsertAccountSnapshot } from '../social/db.js'

function getChannelId(): string | null {
  return getConfig('TELEGRAM_CHANNEL_ID') || null
}

function getBotToken(): string | null {
  return getSecret('CHANNEL_TELEGRAM_BOT_TOKEN') || getSecret('TELEGRAM_BOT_TOKEN') || null
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
    const channelTitle = ('title' in chat ? chat.title : undefined) ?? 'Telegram Channel'

    // Register as social account
    upsertAccount('telegram', channelTitle)
    updateAccountSync('telegram', channelTitle)

    // Save follower snapshot
    const db = getSocialDb()
    const account = db.prepare('SELECT id FROM social_accounts WHERE platform = ?').get('telegram') as { id: number } | undefined
    if (account) {
      upsertAccountSnapshot(account.id, { followers: memberCount })
    }

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
