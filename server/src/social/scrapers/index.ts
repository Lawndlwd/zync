import { logger } from '../../lib/logger.js'
import { getAccounts, getPosts } from '../db.js'
import { getSocialCredentials, getInstagramGraphConfig } from './base.js'
import { fetchInstagramPosts, fetchInstagramComments } from './instagram.js'
import { fetchXPosts, fetchXReplies } from './x.js'
import { fetchYouTubeVideos, fetchYouTubeComments } from './youtube.js'
import { getSecret } from '../../secrets/index.js'
import { fetchTelegramChannelPosts } from '../../telegram/analytics.js'

function isPlatformEnabled(platform: string): boolean {
  const key = `SOCIAL_${platform.toUpperCase()}_ENABLED`
  const val = getSecret(key)
  return val === 'true'
}

export async function syncPlatform(platform: string): Promise<void> {
  // Instagram uses Graph API config instead of username/password
  if (platform === 'instagram') {
    const graphConfig = getInstagramGraphConfig()
    if (!graphConfig) {
      logger.info({ platform }, 'Skipping Instagram sync — no Graph API config')
      return
    }
    try {
      await fetchInstagramPosts()
    } catch (err) {
      logger.error({ err, platform }, 'Platform sync failed')
    }
    return
  }

  if (platform === 'telegram') {
    try {
      await fetchTelegramChannelPosts()
    } catch (err) {
      logger.error({ err, platform }, 'Platform sync failed')
    }
    return
  }

  const creds = getSocialCredentials(platform)
  if (!creds) {
    logger.info({ platform }, 'Skipping sync — no credentials')
    return
  }

  try {
    switch (platform) {
      case 'x':
        await fetchXPosts(creds.username)
        break
      case 'youtube':
        // creds.username is either a @handle, channel ID (UC...), or email
        // If it looks like an email, strip the domain part and try as @handle
        let ytIdentifier = creds.username
        if (ytIdentifier.includes('@') && ytIdentifier.includes('.')) {
          // It's an email — user should enter their YouTube handle instead
          // Try the part before @ as a handle
          ytIdentifier = '@' + ytIdentifier.split('@')[0]
        } else if (!ytIdentifier.startsWith('@') && !ytIdentifier.startsWith('UC')) {
          ytIdentifier = '@' + ytIdentifier
        }
        await fetchYouTubeVideos(ytIdentifier)
        break
    }
  } catch (err) {
    logger.error({ err, platform }, 'Platform sync failed')
  }
}

export async function syncComments(platform: string): Promise<void> {
  const posts = getPosts({ platform, status: 'published', limit: 10 }) as Array<{ platform: string; external_id: string }>

  for (const post of posts) {
    try {
      switch (platform) {
        case 'instagram':
          await fetchInstagramComments(post.external_id)
          break
        case 'x':
          await fetchXReplies(post.external_id)
          break
        case 'youtube':
          await fetchYouTubeComments(post.external_id)
          break
      }
    } catch (err) {
      logger.error({ err, platform, postId: post.external_id }, 'Comment sync failed for post')
    }
  }
}

export async function syncAllPlatforms(): Promise<void> {
  const platforms = ['instagram', 'x', 'youtube', 'telegram']

  for (const platform of platforms) {
    if (!isPlatformEnabled(platform)) {
      logger.info({ platform }, 'Skipping sync — platform disabled')
      continue
    }
    await syncPlatform(platform)
    await syncComments(platform)
  }

  logger.info('All social platforms synced')
}
