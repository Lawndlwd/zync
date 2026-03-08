import { logger } from '../../lib/logger.js'
import { upsertPost, upsertComment, updateAccountSync } from '../db.js'

interface YTVideo {
  videoId: string
  title: string
  thumbnailUrl?: string
  publishedAt?: string
}

interface YTComment {
  commentId: string
  author: string
  text: string
  publishedAt?: string
}

/**
 * Fetches YouTube videos using the public RSS feed (no API key needed).
 * Works for any public channel.
 */
export async function fetchYouTubeVideos(channelIdentifier: string): Promise<void> {
  try {
    // channelIdentifier can be @handle, channel ID, or full URL
    let channelId = channelIdentifier

    // If it's a @handle or URL, we need to resolve the channel ID
    if (channelIdentifier.startsWith('@') || channelIdentifier.includes('youtube.com')) {
      channelId = await resolveChannelId(channelIdentifier) ?? ''
      if (!channelId) {
        logger.warn({ channelIdentifier }, 'YouTube: could not resolve channel ID')
        return
      }
    }

    // Use the public RSS feed — no auth needed
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const res = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!res.ok) {
      logger.warn({ channelId, status: res.status }, 'YouTube RSS feed failed')
      return
    }

    const xml = await res.text()
    const videos = parseRSSVideos(xml)

    for (const video of videos.slice(0, 20)) {
      upsertPost({
        platform: 'youtube',
        external_id: video.videoId,
        content: video.title,
        media_url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
        posted_at: video.publishedAt || null,
      })
    }

    const accountName = channelIdentifier.replace(/^@/, '').split('/').pop() || channelIdentifier
    updateAccountSync('youtube', accountName)
    logger.info({ channelIdentifier, count: videos.length }, 'YouTube videos synced')
  } catch (err) {
    logger.error({ err, channelIdentifier }, 'YouTube fetch failed')
  }
}

async function resolveChannelId(identifier: string): Promise<string | null> {
  try {
    // Fetch the channel page and extract channel ID from meta tags
    let url: string
    if (identifier.includes('youtube.com')) {
      url = identifier
    } else {
      url = `https://www.youtube.com/${identifier.startsWith('@') ? identifier : `@${identifier}`}`
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    if (!res.ok) return null

    const html = await res.text()

    // Extract channel ID from meta tag or page content
    const channelIdMatch = html.match(/(?:"channelId"|"externalId"|channel_id=)"?:?\s*"?(UC[\w-]{22})"?/i)
    if (channelIdMatch) return channelIdMatch[1]

    // Try og:url pattern
    const ogMatch = html.match(/content="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/i)
    if (ogMatch) return ogMatch[1]

    return null
  } catch {
    return null
  }
}

function parseRSSVideos(xml: string): YTVideo[] {
  const videos: YTVideo[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]
    const videoId = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1]
    const thumbnail = entry.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1]

    if (videoId && title) {
      videos.push({
        videoId: videoId.trim(),
        title: decodeXMLEntities(title.trim()),
        thumbnailUrl: thumbnail,
        publishedAt: published?.trim(),
      })
    }
  }

  return videos
}

function decodeXMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * Fetches YouTube comments using the public page (no API key).
 * Extracts from the initial page data JSON.
 */
export async function fetchYouTubeComments(videoId: string): Promise<void> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    if (!res.ok) return

    const html = await res.text()

    // YouTube embeds initial data as JSON in the page
    const dataMatch = html.match(/var ytInitialData = ({[\s\S]*?});\s*<\/script>/)?.[1]
    if (!dataMatch) {
      logger.info({ videoId }, 'YouTube comments: no initial data found (comments load async)')
      return
    }

    // Comments are typically loaded via continuation — not in initial data
    // This is a known limitation of non-API access
    logger.info({ videoId }, 'YouTube comments: loaded async, requires API key for reliable access')
  } catch (err) {
    logger.error({ err, videoId }, 'YouTube comments fetch failed')
  }
}

export async function replyYouTubeComment(_videoId: string, _commentAuthor: string, _text: string): Promise<boolean> {
  logger.warn('YouTube reply requires authenticated API access — not yet implemented')
  return false
}
