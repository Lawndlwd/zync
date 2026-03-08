import { Router } from 'express'
import express from 'express'
import multer from 'multer'
import { errorResponse } from '../lib/errors.js'
import { getSecret, getSecrets } from '../secrets/index.js'
import {
  getAccounts, getPosts, countPosts, getComments, countComments, getRules, getIdeas,
  createDraftPost, updateCommentReply, createRule, updateRule, deleteRule,
  upsertAccount, getInsights,
  getMediaById, updateMediaAnalysis, updatePost, deletePost, getPostById, getCalendarPosts,
} from '../social/db.js'
import { syncAllPlatforms, syncPlatform, syncComments } from '../social/scrapers/index.js'
import { processNewComments } from '../social/auto-reply.js'
import { generateContentIdeas, draftFromIdea } from '../social/ideas.js'
import { getSocialCredentials } from '../social/scrapers/base.js'
import { getOAuthUrl, exchangeCodeForToken, exchangeForLongLivedToken, refreshLongLivedToken, fetchUserProfile, publishPhoto, publishReel, publishCarousel } from '../social/instagram-graph.js'
import { replyInstagramComment } from '../social/scrapers/instagram.js'
import { postTweet } from '../social/scrapers/x.js'
import { saveUploadedFile, deleteMediaFile, getMediaDir } from '../social/media.js'
import { analyzeImage, analyzeVideo, generateCaptionForMedia, generateFromBrief, suggestHashtags, suggestOptimalTime, type MediaAnalysis } from '../social/ai-analyzer.js'
import {
  getWorkshopBoards, createWorkshopBoard, updateWorkshopBoard, deleteWorkshopBoard,
  getWorkshopCards, createWorkshopCard, updateWorkshopCard, deleteWorkshopCard,
  getWorkshopMessages,
} from '../social/db.js'
import { workshopChatStream } from '../social/workshop-chat.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

export const socialRouter = Router()

// Serve uploaded media files
socialRouter.use('/media/file', express.static(getMediaDir()))

// GET /api/social/accounts — list connected accounts
socialRouter.get('/accounts', (_req, res) => {
  try {
    const accounts = getAccounts()
    res.json({ accounts })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/accounts/sync — trigger manual sync
socialRouter.post('/accounts/sync', async (req, res) => {
  try {
    const { platform } = req.body || {}
    if (platform) {
      await syncPlatform(platform)
      await syncComments(platform)
    } else {
      await syncAllPlatforms()
    }
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/posts — list posts (paginated)
socialRouter.get('/posts', (req, res) => {
  try {
    const platform = req.query.platform as string | undefined
    const status = req.query.status as string | undefined
    const sort = req.query.sort as string | undefined
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined
    const limit = req.query.limit ? Number(req.query.limit) : 24
    const page = req.query.page ? Number(req.query.page) : 1
    const offset = (page - 1) * limit
    const posts = getPosts({ platform, status, limit, offset, sort, accountId })
    const total = countPosts({ platform, status, accountId })
    res.json({ posts, total, page, pageSize: limit })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/posts — create/schedule a post
socialRouter.post('/posts', (req, res) => {
  try {
    const { platform, content, scheduled_for, visibility, first_comment, location, alt_text, labels, media_ids, account_id } = req.body
    if (!platform || !content) {
      return res.status(400).json({ error: 'platform and content are required' })
    }
    const id = createDraftPost({
      platform, content, scheduled_for, visibility,
      first_comment: first_comment || null,
      location: location || null,
      alt_text: alt_text || null,
      labels: labels ? JSON.stringify(labels) : null,
      media_ids: media_ids ? JSON.stringify(media_ids) : null,
      account_id: account_id || null,
    })
    res.json({ success: true, id })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/posts/:id — get single post
socialRouter.get('/posts/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const post = getPostById(id)
    if (!post) return res.status(404).json({ error: 'Post not found' })
    res.json({ post })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/comments — list comments (paginated)
socialRouter.get('/comments', (req, res) => {
  try {
    const platform = req.query.platform as string | undefined
    const status = req.query.status as string | undefined
    const post_external_id = req.query.post_external_id as string | undefined
    const sort = req.query.sort as string | undefined
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined
    const limit = req.query.limit ? Number(req.query.limit) : 30
    const page = req.query.page ? Number(req.query.page) : 1
    const offset = (page - 1) * limit
    const comments = getComments({ platform, status, post_external_id, limit, offset, sort, accountId })
    const total = countComments({ platform, status, post_external_id, accountId })
    res.json({ comments, total, page, pageSize: limit })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/comments/:id/reply — reply to a comment
socialRouter.post('/comments/:id/reply', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { reply_content, platform, comment_external_id } = req.body
    if (!reply_content) {
      return res.status(400).json({ error: 'reply_content is required' })
    }

    // If Instagram, send the reply via Graph API
    if (platform === 'instagram' && comment_external_id) {
      const sent = await replyInstagramComment(comment_external_id, reply_content)
      if (!sent) {
        return res.status(502).json({ error: 'Failed to send reply to Instagram' })
      }
    }

    updateCommentReply(id, 'manual_replied', reply_content)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/ideas — list content ideas
socialRouter.get('/ideas', (req, res) => {
  try {
    const platform = req.query.platform as string | undefined
    const status = req.query.status as string | undefined
    const limit = req.query.limit ? Number(req.query.limit) : undefined
    const ideas = getIdeas({ platform, status, limit })
    res.json({ ideas })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/ideas/generate — generate new ideas
socialRouter.post('/ideas/generate', async (req, res) => {
  try {
    const { platform, count, context } = req.body
    if (!platform) {
      return res.status(400).json({ error: 'platform is required' })
    }
    const ideas = await generateContentIdeas(platform, count || 5, context)
    res.json({ ideas })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/ideas/:id/draft — expand idea into draft
socialRouter.post('/ideas/:id/draft', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const draft = await draftFromIdea(id)
    res.json({ draft })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/rules — list auto-reply rules
socialRouter.get('/rules', (req, res) => {
  try {
    const platform = req.query.platform as string | undefined
    const rules = getRules(platform)
    res.json({ rules })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/rules — create rule
socialRouter.post('/rules', (req, res) => {
  try {
    const { platform, pattern, response_template } = req.body
    if (!pattern || !response_template) {
      return res.status(400).json({ error: 'pattern and response_template are required' })
    }
    const id = createRule({ platform: platform || 'all', pattern, response_template })
    res.json({ success: true, id })
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/social/rules/:id — update rule
socialRouter.put('/rules/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const { pattern, response_template, enabled } = req.body
    updateRule(id, { pattern, response_template, enabled })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/social/rules/:id — delete rule
socialRouter.delete('/rules/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    deleteRule(id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/insights — analytics data for a platform (or all)
socialRouter.get('/insights', (req, res) => {
  try {
    const rawPlatform = req.query.platform as string | undefined
    const platform = rawPlatform && rawPlatform !== 'all' ? rawPlatform : null
    const days = req.query.days ? Number(req.query.days) : 30
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined
    const insights = getInsights(platform, days, accountId)
    res.json(insights)
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/instagram/profile — return profile info (pic, username)
socialRouter.get('/instagram/profile', (_req, res) => {
  const profilePic = getSecret('SOCIAL_INSTAGRAM_PROFILE_PIC')
  const username = getSecret('SOCIAL_INSTAGRAM_USERNAME')
  res.json({ profile_picture_url: profilePic || null, username: username || null })
})

// GET /api/social/instagram/auth — redirect to Instagram OAuth
socialRouter.get('/instagram/auth', (req, res) => {
  try {
    const appId = getSecret('SOCIAL_INSTAGRAM_APP_ID')
    if (!appId) {
      return res.status(400).json({ error: 'Save App ID first in Settings before connecting' })
    }

    // Frontend passes its own origin since vite proxy rewrites Host header
    const origin = req.query.origin as string
    if (!origin) {
      return res.status(400).json({ error: 'origin query param required' })
    }
    const redirectUri = `${origin}/api/social/instagram/callback`
    // Pass origin as state param — Instagram forwards it back in callback
    const url = getOAuthUrl(appId, redirectUri, origin)
    res.redirect(url)
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/instagram/callback — handle OAuth redirect, exchange code for tokens
socialRouter.get('/instagram/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined
    const error = req.query.error_description as string | undefined
    if (error || !code) {
      return res.redirect(`/settings?ig_error=${encodeURIComponent(error || 'Authorization denied')}`)
    }

    const secretsSvc = getSecrets()
    if (!secretsSvc) {
      return res.redirect('/settings?ig_error=Vault+not+available')
    }

    const appId = getSecret('SOCIAL_INSTAGRAM_APP_ID')
    const appSecret = getSecret('SOCIAL_INSTAGRAM_APP_SECRET')
    if (!appId || !appSecret) {
      return res.redirect('/settings?ig_error=Missing+App+ID+or+Secret')
    }

    // Reconstruct the same redirect URI using state param from OAuth
    const origin = req.query.state as string
    if (!origin) {
      return res.redirect('/settings?ig_error=Missing+OAuth+state.+Try+again.')
    }
    const redirectUri = `${origin}/api/social/instagram/callback`

    // Exchange auth code for short-lived token (returns user_id)
    const shortResult = await exchangeCodeForToken(appId, appSecret, code, redirectUri)

    // Exchange short-lived token for long-lived token (60 days)
    const longResult = await exchangeForLongLivedToken(appSecret, shortResult.access_token)

    // Get username
    const profile = await fetchUserProfile(longResult.access_token)
    const igUserId = String(shortResult.user_id)

    // Store in vault
    secretsSvc.set('SOCIAL_INSTAGRAM_ACCESS_TOKEN', longResult.access_token, 'social')
    secretsSvc.set('SOCIAL_INSTAGRAM_USER_ID', igUserId, 'social')
    const expiresAt = new Date(Date.now() + longResult.expires_in * 1000).toISOString()
    secretsSvc.set('SOCIAL_INSTAGRAM_TOKEN_EXPIRES', expiresAt, 'social')

    upsertAccount('instagram', igUserId)
    secretsSvc.set('SOCIAL_INSTAGRAM_USERNAME', profile.username, 'social')
    if (profile.profile_picture_url) {
      secretsSvc.set('SOCIAL_INSTAGRAM_PROFILE_PIC', profile.profile_picture_url, 'social')
    }

    res.redirect(`/settings?ig_connected=${encodeURIComponent(profile.username)}`)
  } catch (err: any) {
    const msg = err.message || 'Connection failed'
    res.redirect(`/settings?ig_error=${encodeURIComponent(msg)}`)
  }
})

// POST /api/social/instagram/refresh-token — refresh long-lived token
socialRouter.post('/instagram/refresh-token', async (_req, res) => {
  try {
    const secretsSvc = getSecrets()
    if (!secretsSvc) {
      return res.status(503).json({ error: 'Vault not available' })
    }

    const currentToken = getSecret('SOCIAL_INSTAGRAM_ACCESS_TOKEN')
    if (!currentToken) {
      return res.status(400).json({ error: 'Instagram not connected — no access token' })
    }

    const result = await refreshLongLivedToken(currentToken)
    secretsSvc.set('SOCIAL_INSTAGRAM_ACCESS_TOKEN', result.access_token, 'social')
    const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString()
    secretsSvc.set('SOCIAL_INSTAGRAM_TOKEN_EXPIRES', expiresAt, 'social')

    res.json({ success: true, expiresAt })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Media endpoints ---

// POST /api/social/media/upload — upload media file
socialRouter.post('/media/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    const record = await saveUploadedFile(file)
    res.json({ media: record })
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/media/:id/thumb — serve file by ID (for calendar thumbnails)
socialRouter.get('/media/:id/thumb', (req, res) => {
  try {
    const id = Number(req.params.id)
    const media = getMediaById(id)
    if (!media) return res.status(404).json({ error: 'Media not found' })
    res.redirect(`/api/social/media/file/${media.filename}`)
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/media/:id — get media metadata
socialRouter.get('/media/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const media = getMediaById(id)
    if (!media) return res.status(404).json({ error: 'Media not found' })
    res.json({ media })
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/social/media/:id — delete media
socialRouter.delete('/media/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const deleted = deleteMediaFile(id)
    if (!deleted) return res.status(404).json({ error: 'Media not found' })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/media/:id/analyze — trigger AI analysis
socialRouter.post('/media/:id/analyze', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const media = getMediaById(id)
    if (!media) return res.status(404).json({ error: 'Media not found' })

    const analysis = media.media_type === 'video'
      ? await analyzeVideo(media.storage_path)
      : await analyzeImage(media.storage_path)

    updateMediaAnalysis(id, JSON.stringify(analysis))
    res.json({ analysis })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Post management endpoints ---

// PUT /api/social/posts/:id — update draft post
socialRouter.put('/posts/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const post = getPostById(id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const { content, scheduled_for, media_ids, visibility, first_comment, location, alt_text, labels } = req.body
    const status = scheduled_for ? 'scheduled' : 'draft'
    updatePost(id, {
      content,
      scheduled_for: scheduled_for ?? null,
      media_ids: media_ids ? JSON.stringify(media_ids) : undefined,
      status,
      visibility,
      first_comment,
      location,
      alt_text,
      labels: labels ? JSON.stringify(labels) : undefined,
    })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// DELETE /api/social/posts/:id — delete post
socialRouter.delete('/posts/:id', (req, res) => {
  try {
    const id = Number(req.params.id)
    const post = getPostById(id)
    if (!post) return res.status(404).json({ error: 'Post not found' })
    deletePost(id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/posts/:id/publish — publish now (supports Reels + multi-platform)
socialRouter.post('/posts/:id/publish', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const post = getPostById(id)
    if (!post) return res.status(404).json({ error: 'Post not found' })

    const results: Array<{ platform: string; externalId?: string; error?: string }> = []

    // Determine which platforms to publish to
    // The `platforms` body param allows multi-platform publishing from a single draft
    const targetPlatforms: string[] = req.body?.platforms?.length
      ? req.body.platforms
      : [post.platform]

    // Resolve media URLs from attached media
    const publicUrl = getSecret('SOCIAL_MEDIA_PUBLIC_URL') || `${req.protocol}://${req.get('host')}`
    const mediaList: Array<{ url: string; type: 'image' | 'video' }> = []

    if (post.media_ids) {
      const mediaIds = JSON.parse(post.media_ids || '[]') as number[]
      for (const mid of mediaIds) {
        const media = getMediaById(mid)
        if (media) {
          mediaList.push({
            url: `${publicUrl}/api/social/media/file/${media.filename}`,
            type: media.media_type as 'image' | 'video',
          })
        }
      }
    }

    // Fallback to post.media_url if no media_ids
    if (mediaList.length === 0 && post.media_url) {
      const type = /\.(mp4|mov|avi|webm)$/i.test(post.media_url) ? 'video' as const : 'image' as const
      mediaList.push({ url: post.media_url, type })
    }

    for (const targetPlatform of targetPlatforms) {
      try {
        switch (targetPlatform) {
          case 'instagram': {
            const accessToken = getSecret('SOCIAL_INSTAGRAM_ACCESS_TOKEN')
            const userId = getSecret('SOCIAL_INSTAGRAM_USER_ID')
            if (!accessToken || !userId) {
              results.push({ platform: 'instagram', error: 'Instagram not connected' })
              break
            }
            if (mediaList.length === 0) {
              results.push({ platform: 'instagram', error: 'Instagram requires media to publish' })
              break
            }

            let externalId: string
            if (mediaList.length > 1) {
              // Carousel post (multiple images/videos)
              externalId = await publishCarousel(userId, accessToken, mediaList, post.content)
            } else if (mediaList[0].type === 'video') {
              externalId = await publishReel(userId, accessToken, mediaList[0].url, post.content)
            } else {
              externalId = await publishPhoto(userId, accessToken, mediaList[0].url, post.content)
            }
            results.push({ platform: 'instagram', externalId })
            break
          }
          case 'x': {
            const externalId = await postTweet(post.content)
            if (externalId) {
              results.push({ platform: 'x', externalId })
            } else {
              results.push({ platform: 'x', error: 'X posting not yet configured' })
            }
            break
          }
          case 'youtube': {
            results.push({ platform: 'youtube', error: 'YouTube video publishing via API not yet supported' })
            break
          }
          default:
            results.push({ platform: targetPlatform, error: `Unknown platform: ${targetPlatform}` })
        }
      } catch (err: any) {
        results.push({ platform: targetPlatform, error: err.message || 'Publish failed' })
      }
    }

    // If at least one platform succeeded, mark as published
    const anySuccess = results.some((r) => r.externalId)
    if (anySuccess) {
      updatePost(id, { status: 'published' })
    }

    res.json({ success: anySuccess, results })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- AI endpoints ---

// POST /api/social/ai/caption — generate caption from analysis
socialRouter.post('/ai/caption', async (req, res) => {
  try {
    const { analysis, style } = req.body
    if (!analysis) return res.status(400).json({ error: 'analysis is required' })
    const result = await generateCaptionForMedia(analysis as MediaAnalysis, style)
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/ai/hashtags — suggest hashtags
socialRouter.post('/ai/hashtags', async (req, res) => {
  try {
    const { content } = req.body
    if (!content) return res.status(400).json({ error: 'content is required' })
    const hashtags = await suggestHashtags(content)
    res.json({ hashtags })
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/ai/generate — generate caption or first comment from brief
socialRouter.post('/ai/generate', async (req, res) => {
  try {
    const { brief, tone, platform, language, existingCaption, target } = req.body
    if (!brief) return res.status(400).json({ error: 'brief is required' })
    const result = await generateFromBrief({
      brief,
      tone: tone || 'casual',
      platform: platform || 'instagram',
      language,
      existingCaption,
      target: target || 'caption',
    })
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

// POST /api/social/ai/optimal-time — recommended posting time
socialRouter.post('/ai/optimal-time', async (req, res) => {
  try {
    const { platform } = req.body
    if (!platform) return res.status(400).json({ error: 'platform is required' })
    const result = await suggestOptimalTime(platform)
    res.json(result)
  } catch (err) {
    errorResponse(res, err)
  }
})

// GET /api/social/calendar — posts by date range
socialRouter.get('/calendar', (req, res) => {
  try {
    const start = req.query.start as string
    const end = req.query.end as string
    const platform = req.query.platform as string | undefined
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required' })
    const posts = getCalendarPosts(start, end, platform, accountId)
    res.json({ posts })
  } catch (err) {
    errorResponse(res, err)
  }
})

// PUT /api/social/config — save platform credentials to vault
socialRouter.put('/config', (req, res) => {
  try {
    const secretsSvc = getSecrets()
    if (!secretsSvc) {
      return res.status(503).json({ error: 'Vault not available' })
    }

    const { instagram, x, youtube, autoReplyEnabled, autoReplyPrompt, autoReplyRequireApproval } = req.body
    const isMasked = (v?: string) => !v || v.startsWith('••••')

    if (instagram) {
      if (instagram.appId) secretsSvc.set('SOCIAL_INSTAGRAM_APP_ID', instagram.appId, 'social')
      if (!isMasked(instagram.appSecret)) secretsSvc.set('SOCIAL_INSTAGRAM_APP_SECRET', instagram.appSecret, 'social')
      if (!isMasked(instagram.accessToken)) secretsSvc.set('SOCIAL_INSTAGRAM_ACCESS_TOKEN', instagram.accessToken, 'social')
      if (instagram.username) upsertAccount('instagram', instagram.username)
      if (instagram.enabled !== undefined) secretsSvc.set('SOCIAL_INSTAGRAM_ENABLED', String(instagram.enabled), 'social')
    }
    if (x) {
      if (x.username) secretsSvc.set('SOCIAL_X_USERNAME', x.username, 'social')
      if (!isMasked(x.password)) secretsSvc.set('SOCIAL_X_PASSWORD', x.password, 'social')
      if (x.username) upsertAccount('x', x.username)
      if (x.enabled !== undefined) secretsSvc.set('SOCIAL_X_ENABLED', String(x.enabled), 'social')
    }
    if (youtube) {
      if (youtube.email) secretsSvc.set('SOCIAL_YOUTUBE_USERNAME', youtube.email, 'social')
      if (!isMasked(youtube.password)) secretsSvc.set('SOCIAL_YOUTUBE_PASSWORD', youtube.password, 'social')
      if (youtube.email) upsertAccount('youtube', youtube.email)
      if (youtube.enabled !== undefined) secretsSvc.set('SOCIAL_YOUTUBE_ENABLED', String(youtube.enabled), 'social')
    }

    // Auto-reply settings
    if (autoReplyEnabled !== undefined) secretsSvc.set('SOCIAL_AUTO_REPLY_ENABLED', String(autoReplyEnabled), 'social')
    if (autoReplyPrompt !== undefined) secretsSvc.set('SOCIAL_AUTO_REPLY_PROMPT', autoReplyPrompt, 'social')
    if (autoReplyRequireApproval !== undefined) secretsSvc.set('SOCIAL_AUTO_REPLY_REQUIRE_APPROVAL', String(autoReplyRequireApproval), 'social')

    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// --- Workshop routes ---

socialRouter.get('/workshop/boards', (_req, res) => {
  try {
    const boards = getWorkshopBoards()
    res.json({ boards })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.post('/workshop/boards', (req, res) => {
  try {
    const { name, platform } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    const id = createWorkshopBoard(name, platform || 'general')
    res.json({ id, name, platform: platform || 'general' })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.put('/workshop/boards/:id', (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ error: 'name is required' })
    updateWorkshopBoard(Number(req.params.id), name)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.delete('/workshop/boards/:id', (req, res) => {
  try {
    deleteWorkshopBoard(Number(req.params.id))
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.get('/workshop/boards/:id/cards', (req, res) => {
  try {
    const cards = getWorkshopCards(Number(req.params.id))
    res.json({ cards })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.post('/workshop/boards/:id/cards', (req, res) => {
  try {
    const { title, description, column_name, tags } = req.body
    if (!title) return res.status(400).json({ error: 'title is required' })
    const id = createWorkshopCard({
      board_id: Number(req.params.id),
      title,
      description,
      column_name,
      tags: tags ? JSON.stringify(tags) : undefined,
    })
    res.json({ id })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.put('/workshop/cards/:id', (req, res) => {
  try {
    const { title, description, column_name, tags, notes, position } = req.body
    updateWorkshopCard(Number(req.params.id), {
      title, description, column_name,
      tags: tags ? JSON.stringify(tags) : undefined,
      notes, position,
    })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.delete('/workshop/cards/:id', (req, res) => {
  try {
    deleteWorkshopCard(Number(req.params.id))
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.get('/workshop/boards/:id/messages', (req, res) => {
  try {
    const messages = getWorkshopMessages(Number(req.params.id))
    res.json({ messages })
  } catch (err) {
    errorResponse(res, err)
  }
})

socialRouter.post('/workshop/boards/:id/chat', async (req, res) => {
  const { message, boardName, platform } = req.body
  if (!message) return res.status(400).json({ error: 'message is required' })
  try {
    await workshopChatStream(
      Number(req.params.id),
      message,
      boardName || 'Workshop',
      platform || 'general',
      res
    )
  } catch (err) {
    if (!res.headersSent) {
      errorResponse(res, err)
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    }
  }
})

