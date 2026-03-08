import { logger } from '../lib/logger.js'

const IG_GRAPH_BASE = 'https://graph.instagram.com/v21.0'

interface GraphError {
  error: {
    message: string
    type: string
    code: number
    error_subcode?: number
  }
}

interface IGMediaNode {
  id: string
  caption?: string
  media_type: string
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  permalink?: string
  like_count?: number
  comments_count?: number
}

interface IGCommentNode {
  id: string
  text: string
  username?: string
  timestamp: string
  from?: { id: string; username: string }
}

async function graphFetch(path: string, accessToken: string, options?: RequestInit & { retries?: number }): Promise<any> {
  const maxRetries = options?.retries ?? 3
  const url = new URL(`${IG_GRAPH_BASE}${path}`)
  if (!url.searchParams.has('access_token')) {
    url.searchParams.set('access_token', accessToken)
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url.toString(), {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })

    if (res.ok) return res.json()

    const body = await res.json().catch(() => null) as GraphError | null
    const code = body?.error?.code
    const subcode = body?.error?.error_subcode

    // Token expired
    if (code === 190) {
      logger.warn({ subcode }, 'Instagram API: token expired or invalid')
      throw new Error('INSTAGRAM_TOKEN_EXPIRED')
    }

    // Rate limited
    if (res.status === 429 || code === 4 || code === 17) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt) * 1000
        logger.warn({ attempt, backoff }, 'Instagram API: rate limited, backing off')
        await new Promise((r) => setTimeout(r, backoff))
        continue
      }
    }

    const msg = body?.error?.message || `HTTP ${res.status}`
    logger.error({ code, subcode, msg, path }, 'Instagram API error')
    throw new Error(`Instagram API: ${msg}`)
  }
}

// --- OAuth (Instagram Login flow) ---

export function getOAuthUrl(appId: string, redirectUri: string, state?: string): string {
  const scopes = [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_comments',
    'instagram_business_manage_messages',
    'instagram_business_manage_insights',
  ].join(',')
  let url = `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&enable_fb_login=0&force_authentication=1`
  if (state) url += `&state=${encodeURIComponent(state)}`
  return url
}

export async function exchangeCodeForToken(
  appId: string,
  appSecret: string,
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; user_id: number }> {
  // Instagram token exchange uses form-encoded POST
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error_message || body?.error?.message || 'Code exchange failed')
  }
  return res.json()
}

export async function exchangeForLongLivedToken(
  appSecret: string,
  shortToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const url = `${IG_GRAPH_BASE}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(shortToken)}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || 'Long-lived token exchange failed')
  }
  return res.json()
}

export async function refreshLongLivedToken(
  currentToken: string,
): Promise<{ access_token: string; expires_in: number }> {
  const url = `${IG_GRAPH_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(currentToken)}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || 'Token refresh failed')
  }
  return res.json()
}

export async function fetchUserProfile(accessToken: string): Promise<{ id: string; username: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number }> {
  const data = await graphFetch('/me?fields=user_id,username,profile_picture_url,followers_count,follows_count,media_count', accessToken)
  logger.info({ fields: { followers_count: data.followers_count, follows_count: data.follows_count, media_count: data.media_count } }, 'Instagram profile response')
  return { id: data.user_id ?? data.id, username: data.username, profile_picture_url: data.profile_picture_url, followers_count: data.followers_count, follows_count: data.follows_count, media_count: data.media_count }
}

export async function fetchAccountInsights(accessToken: string, period = 'day', days = 30): Promise<any> {
  const since = Math.floor((Date.now() - days * 86400_000) / 1000)
  const until = Math.floor(Date.now() / 1000)
  const data = await graphFetch(
    `/me/insights?metric=reach,accounts_engaged,profile_views&period=${period}&since=${since}&until=${until}`,
    accessToken,
  )
  return data
}

export async function fetchMediaInsights(
  mediaId: string,
  accessToken: string,
  mediaType?: string,
): Promise<{ reach: number; impressions: number; saved: number; shares: number }> {
  // All media types (FEED, REEL, CAROUSEL_ALBUM) now use the same metrics:
  //   reach, views, saved, shares
  // 'impressions' deprecated after July 2024, 'plays' deprecated v22+ — both replaced by 'views'
  // Note: album *children* don't support insights, only the parent carousel does
  const metricList = 'reach,views,saved,shares'

  try {
    const data = await graphFetch(`/${mediaId}/insights?metric=${metricList}`, accessToken, { retries: 0 })
    const metrics: Record<string, number> = {}
    for (const entry of data?.data || []) {
      metrics[entry.name] = entry.total_value?.value ?? entry.values?.[0]?.value ?? 0
    }
    return {
      reach: metrics.reach ?? 0,
      impressions: metrics.views ?? 0,
      saved: metrics.saved ?? 0,
      shares: metrics.shares ?? 0,
    }
  } catch {
    return { reach: 0, impressions: 0, saved: 0, shares: 0 }
  }
}

// --- Data fetching ---

export async function fetchMedia(
  _igUserId: string,
  accessToken: string,
  afterCursor?: string | null,
): Promise<{ posts: IGMediaNode[]; nextCursor: string | null }> {
  let path = `/me/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count&limit=20`
  if (afterCursor) path += `&after=${encodeURIComponent(afterCursor)}`

  const data = await graphFetch(path, accessToken)
  return {
    posts: data?.data || [],
    nextCursor: data?.paging?.cursors?.after || null,
  }
}

export async function fetchComments(
  mediaId: string,
  accessToken: string,
  afterCursor?: string | null,
): Promise<{ comments: IGCommentNode[]; nextCursor: string | null }> {
  let path = `/${mediaId}/comments?fields=id,text,username,timestamp,from&limit=50`
  if (afterCursor) path += `&after=${encodeURIComponent(afterCursor)}`

  const data = await graphFetch(path, accessToken)
  if (data?.data?.length === 0) {
    logger.debug({ mediaId, raw: JSON.stringify(data).slice(0, 200) }, 'Comments endpoint returned empty')
  }
  return {
    comments: data?.data || [],
    nextCursor: data?.paging?.cursors?.after || null,
  }
}

// --- Write operations ---

export async function publishPhoto(
  _igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
): Promise<string> {
  // Step 1: Create media container
  const container = await graphFetch('/me/media', accessToken, {
    method: 'POST',
    body: JSON.stringify({ image_url: imageUrl, caption }),
  })

  if (!container?.id) throw new Error('Failed to create media container')

  // Step 2: Publish the container
  const published = await graphFetch('/me/media_publish', accessToken, {
    method: 'POST',
    body: JSON.stringify({ creation_id: container.id }),
  })

  if (!published?.id) throw new Error('Failed to publish media')
  return published.id
}

export async function publishReel(
  _igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
): Promise<string> {
  // Step 1: Create REELS container
  const container = await graphFetch('/me/media', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
    }),
  })

  if (!container?.id) throw new Error('Failed to create Reel container')

  // Step 2: Poll container status — video processing takes time
  const deadline = Date.now() + 120_000 // 2 min timeout
  while (Date.now() < deadline) {
    const status = await graphFetch(`/${container.id}?fields=status_code`, accessToken)
    if (status?.status_code === 'FINISHED') break
    if (status?.status_code === 'ERROR') throw new Error('Reel processing failed on Instagram')
    await new Promise((r) => setTimeout(r, 3000))
  }

  // Step 3: Publish the container
  const published = await graphFetch('/me/media_publish', accessToken, {
    method: 'POST',
    body: JSON.stringify({ creation_id: container.id }),
  })

  if (!published?.id) throw new Error('Failed to publish Reel')
  return published.id
}

export async function publishCarousel(
  _igUserId: string,
  accessToken: string,
  mediaUrls: Array<{ url: string; type: 'image' | 'video' }>,
  caption: string,
): Promise<string> {
  // Step 1: Create child containers for each media item
  const childIds: string[] = []
  for (const item of mediaUrls) {
    const body: any = item.type === 'video'
      ? { media_type: 'VIDEO', video_url: item.url, is_carousel_item: true }
      : { image_url: item.url, is_carousel_item: true }

    const child = await graphFetch('/me/media', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!child?.id) throw new Error('Failed to create carousel child container')

    // For video children, wait for processing
    if (item.type === 'video') {
      const deadline = Date.now() + 120_000
      while (Date.now() < deadline) {
        const status = await graphFetch(`/${child.id}?fields=status_code`, accessToken)
        if (status?.status_code === 'FINISHED') break
        if (status?.status_code === 'ERROR') throw new Error('Video processing failed for carousel item')
        await new Promise((r) => setTimeout(r, 3000))
      }
    }

    childIds.push(child.id)
  }

  // Step 2: Create carousel container
  const carousel = await graphFetch('/me/media', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
    }),
  })
  if (!carousel?.id) throw new Error('Failed to create carousel container')

  // Step 3: Publish
  const published = await graphFetch('/me/media_publish', accessToken, {
    method: 'POST',
    body: JSON.stringify({ creation_id: carousel.id }),
  })
  if (!published?.id) throw new Error('Failed to publish carousel')
  return published.id
}

export async function replyToComment(
  commentId: string,
  accessToken: string,
  message: string,
): Promise<string> {
  const result = await graphFetch(`/${commentId}/replies`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })

  if (!result?.id) throw new Error('Failed to reply to comment')
  return result.id
}
