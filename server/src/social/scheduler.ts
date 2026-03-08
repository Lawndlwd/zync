import * as cron from 'node-cron'
import { logger } from '../lib/logger.js'
import { getConfig } from '../config/index.js'
import { getSecret, getSecrets } from '../secrets/index.js'
import { syncAllPlatforms } from './scrapers/index.js'
import { getScheduledPostsDue, updatePostStatus } from './db.js'
import { postInstagramContent } from './scrapers/instagram.js'
import { postTweet } from './scrapers/x.js'
import { refreshLongLivedToken } from './instagram-graph.js'

let scheduledTask: cron.ScheduledTask | null = null

export function getSocialSyncCron(): string {
  return getConfig('SOCIAL_SYNC_CRON') || '*/30 * * * *'
}

export function scheduleSocialSync(): void {
  stopSocialSync()

  const cronExpr = getSocialSyncCron()
  const tz = getConfig('SCHEDULE_TIMEZONE', 'Europe/Paris') || 'Europe/Paris'

  scheduledTask = cron.schedule(cronExpr, () => {
    runSocialSync().catch((err) => logger.error({ err }, 'Scheduled social sync failed'))
  }, { timezone: tz })

  logger.info({ cronExpr, tz }, 'Social media sync scheduled')
}

export function stopSocialSync(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    logger.info('Social media sync stopped')
  }
}

async function maybeRefreshInstagramToken(): Promise<void> {
  try {
    const expires = getSecret('SOCIAL_INSTAGRAM_TOKEN_EXPIRES')
    if (!expires) return

    const expiresAt = new Date(expires)
    const now = new Date()
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    if (daysUntilExpiry > 7) return

    const currentToken = getSecret('SOCIAL_INSTAGRAM_ACCESS_TOKEN')
    if (!currentToken) {
      logger.warn('Instagram token expiring soon but no access token found')
      return
    }

    const result = await refreshLongLivedToken(currentToken)
    const secretsSvc = getSecrets()
    if (secretsSvc) {
      secretsSvc.set('SOCIAL_INSTAGRAM_ACCESS_TOKEN', result.access_token, 'social')
      const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString()
      secretsSvc.set('SOCIAL_INSTAGRAM_TOKEN_EXPIRES', newExpiry, 'social')
      logger.info({ daysUntilExpiry: Math.round(daysUntilExpiry) }, 'Instagram token refreshed')
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to refresh Instagram token — will retry next sync')
  }
}

function isSyncEnabled(): boolean {
  const val = getConfig('SOCIAL_SYNC_ENABLED')
  // Default to true if not explicitly set to 'false'
  return val !== 'false'
}

async function runSocialSync(): Promise<void> {
  if (!isSyncEnabled()) {
    logger.debug('Social sync disabled via SOCIAL_SYNC_ENABLED=false')
    return
  }
  logger.info('Running scheduled social sync')

  // 0. Refresh Instagram token if expiring soon
  await maybeRefreshInstagramToken()

  // 1. Sync posts and comments from all platforms
  await syncAllPlatforms()

  // 2. Process auto-replies (only runs if enabled in settings)
  const { processNewComments } = await import('./auto-reply.js')
  await processNewComments()

  // 3. Publish scheduled posts that are due
  await publishScheduledPosts()
}

async function publishScheduledPosts(): Promise<void> {
  const duePosts = getScheduledPostsDue() as Array<{
    id: number
    platform: string
    content: string
    media_url: string | null
  }>

  for (const post of duePosts) {
    try {
      let externalId: string | null = null

      switch (post.platform) {
        case 'instagram':
          externalId = await postInstagramContent(post.content, post.media_url ?? undefined)
          break
        case 'x':
          externalId = await postTweet(post.content)
          break
        case 'youtube':
          // YouTube video posting via scraping isn't practical
          logger.warn({ postId: post.id }, 'YouTube post publishing not supported via scraping')
          continue
      }

      if (externalId) {
        updatePostStatus(post.id, 'published', externalId)
        logger.info({ postId: post.id, platform: post.platform }, 'Scheduled post published')
      }
    } catch (err) {
      logger.error({ err, postId: post.id }, 'Failed to publish scheduled post')
    }
  }
}
