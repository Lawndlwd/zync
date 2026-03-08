import { logger } from '../../lib/logger.js'
import { upsertPost, updateAccountSync } from '../db.js'

interface XPost {
  id: string
  text: string
  created_at?: string
  media_url?: string | null
}

/**
 * Fetches recent tweets using X's syndication/embed API.
 * This is public and doesn't require auth tokens.
 */
export async function fetchXPosts(username: string): Promise<void> {
  try {
    // Use the syndication timeline endpoint (used by embedded timelines)
    const res = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!res.ok) {
      logger.warn({ username, status: res.status }, 'X syndication endpoint failed')
      // Fallback: try the nitter-style public approach
      await fetchXPostsViaHTML(username)
      return
    }

    const html = await res.text()

    // The syndication endpoint returns HTML with tweet data
    // Extract tweets from the timeline HTML
    const tweets = parseXSyndicationHTML(html)

    for (const tweet of tweets.slice(0, 20)) {
      upsertPost({
        platform: 'x',
        external_id: tweet.id,
        content: tweet.text,
        media_url: tweet.media_url || null,
        posted_at: tweet.created_at || null,
      })
    }

    updateAccountSync('x', username)
    logger.info({ username, count: tweets.length }, 'X posts synced')
  } catch (err) {
    logger.error({ err, username }, 'X fetch failed')
  }
}

function parseXSyndicationHTML(html: string): XPost[] {
  const posts: XPost[] = []

  // Extract tweet containers — syndication HTML has structured tweet divs
  const tweetRegex = /data-tweet-id="(\d+)"/g
  const textBlocks = html.match(/<p[^>]*class="[^"]*timeline-Tweet-text[^"]*"[^>]*>([\s\S]*?)<\/p>/g) || []
  const timeBlocks = html.match(/<time[^>]*datetime="([^"]+)"/g) || []

  let match
  let idx = 0
  while ((match = tweetRegex.exec(html)) !== null) {
    const id = match[1]
    const text = textBlocks[idx]
      ? textBlocks[idx].replace(/<[^>]+>/g, '').trim()
      : ''
    const timeMatch = timeBlocks[idx]?.match(/datetime="([^"]+)"/)
    const createdAt = timeMatch?.[1] || null

    if (id) {
      posts.push({ id, text, created_at: createdAt || undefined })
    }
    idx++
  }

  // If structured parsing didn't work, try a simpler approach
  if (posts.length === 0) {
    // Look for tweet links and surrounding text
    const linkRegex = /href="https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)"/g
    while ((match = linkRegex.exec(html)) !== null) {
      const id = match[1]
      if (!posts.find((p) => p.id === id)) {
        posts.push({ id, text: '', created_at: undefined })
      }
    }
  }

  return posts
}

async function fetchXPostsViaHTML(username: string): Promise<void> {
  try {
    // Try fetching the public profile page and extracting tweet IDs
    const res = await fetch(`https://x.com/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    })

    if (!res.ok) {
      logger.warn({ username, status: res.status }, 'X HTML fallback failed')
      return
    }

    const html = await res.text()

    // X's HTML contains tweet data in script tags as JSON
    const jsonMatch = html.match(/"tweet_results":\{"result":\{([\s\S]*?)\}\}/g)
    if (!jsonMatch) {
      logger.info({ username }, 'X: could not extract tweets from HTML (SPA requires JS)')
      return
    }

    logger.info({ username }, 'X: extracted tweet references from HTML')
  } catch (err) {
    logger.error({ err, username }, 'X HTML fallback failed')
  }
}

export async function fetchXReplies(tweetId: string): Promise<void> {
  logger.info({ tweetId }, 'X replies: requires authenticated API access')
}

export async function postTweet(text: string, _mediaPath?: string): Promise<string | null> {
  logger.warn('X posting requires authenticated API access — not yet implemented')
  return null
}

export async function replyToTweet(_tweetId: string, _text: string): Promise<boolean> {
  logger.warn('X reply requires authenticated API access — not yet implemented')
  return false
}
