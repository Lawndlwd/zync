import { logger } from '../../lib/logger.js'
import { upsertPost, upsertComment, updateAccountSync, getAccountSyncCursor, updateAccountSyncCursor, upsertAccountSnapshot, getAccounts } from '../db.js'
import { getInstagramGraphConfig } from './base.js'
import { fetchMedia, fetchComments, fetchMediaInsights, fetchUserProfile, publishPhoto, replyToComment } from '../instagram-graph.js'

export async function fetchInstagramPosts(): Promise<void> {
  const config = getInstagramGraphConfig()
  if (!config) {
    logger.info('Instagram: no Graph API config — skipping post sync')
    return
  }

  try {
    // Fetch account profile for follower snapshots
    try {
      const profile = await fetchUserProfile(config.accessToken)
      if (profile.followers_count != null) {
        const accounts = getAccounts() as Array<{ id: number; platform: string; username: string }>
        const igAccount = accounts.find((a) => a.platform === 'instagram')
        if (igAccount) {
          upsertAccountSnapshot(igAccount.id, {
            followers: profile.followers_count,
            following: profile.follows_count,
            posts_count: profile.media_count,
          })
          logger.info({ followers: profile.followers_count }, 'Instagram follower snapshot recorded')
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to fetch Instagram profile for snapshot')
    }

    const cursor = getAccountSyncCursor('instagram', config.igUserId)
    const { posts, nextCursor } = await fetchMedia(config.igUserId, config.accessToken, cursor)

    let count = 0
    for (const media of posts) {
      // Fetch per-post insights (reach, impressions, saved, shares)
      const insights = await fetchMediaInsights(media.id, config.accessToken, media.media_type)

      const mediaUrl = media.media_type === 'VIDEO' ? (media.thumbnail_url || null) : (media.media_url || null)
      upsertPost({
        platform: 'instagram',
        external_id: media.id,
        content: media.caption || '',
        media_url: mediaUrl,
        posted_at: media.timestamp,
        like_count: media.like_count ?? 0,
        comments_count: media.comments_count ?? 0,
        permalink: media.permalink ?? null,
        reach: insights.reach,
        impressions: insights.impressions,
        saves_count: insights.saved,
        shares_count: insights.shares,
      })
      count++
    }

    if (nextCursor) {
      updateAccountSyncCursor('instagram', config.igUserId, nextCursor)
    }

    updateAccountSync('instagram', config.igUserId)
    logger.info({ count }, 'Instagram posts synced via Graph API')
  } catch (err: any) {
    if (err.message === 'INSTAGRAM_TOKEN_EXPIRED') {
      logger.warn('Instagram token expired — skipping sync. Reconnect in Settings.')
      return
    }
    logger.error({ err }, 'Instagram Graph API fetch failed')
  }
}

export async function fetchInstagramComments(postExternalId: string): Promise<void> {
  const config = getInstagramGraphConfig()
  if (!config) return

  try {
    const { comments } = await fetchComments(postExternalId, config.accessToken)

    let count = 0
    for (const comment of comments) {
      upsertComment({
        platform: 'instagram',
        post_external_id: postExternalId,
        external_id: comment.id,
        author: comment.username || comment.from?.username || 'unknown',
        content: comment.text || '',
        created_at: comment.timestamp,
      })
      count++
    }

    logger.info({ postExternalId, count }, 'Instagram comments synced via Graph API')
  } catch (err: any) {
    if (err.message === 'INSTAGRAM_TOKEN_EXPIRED') return
    logger.error({ err, postExternalId }, 'Instagram comments fetch failed')
  }
}

export async function postInstagramContent(content: string, mediaUrl?: string): Promise<string | null> {
  const config = getInstagramGraphConfig()
  if (!config) {
    logger.warn('Instagram: no Graph API config — cannot publish')
    return null
  }

  if (!mediaUrl) {
    logger.warn('Instagram Graph API requires a public image URL to publish')
    return null
  }

  try {
    const mediaId = await publishPhoto(config.igUserId, config.accessToken, mediaUrl, content)
    logger.info({ mediaId }, 'Instagram photo published via Graph API')
    return mediaId
  } catch (err: any) {
    logger.error({ err }, 'Instagram publish failed')
    return null
  }
}

export async function replyInstagramComment(commentId: string, text: string): Promise<boolean> {
  const config = getInstagramGraphConfig()
  if (!config) {
    logger.warn('Instagram: no Graph API config — cannot reply')
    return false
  }

  try {
    await replyToComment(commentId, config.accessToken, text)
    logger.info({ commentId }, 'Instagram comment reply sent via Graph API')
    return true
  } catch (err: any) {
    logger.error({ err, commentId }, 'Instagram reply failed')
    return false
  }
}
