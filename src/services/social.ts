import type { SocialAccount, SocialPost, SocialComment, ReplyRule, ContentIdea, SocialPlatform, SocialMedia, MediaAnalysis, CaptionSuggestion, SocialInsights, WorkshopBoard, WorkshopCard, WorkshopMessage } from '@/types/social'
export type { SocialInsights }

const API_BASE = '/api/social'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(`Social API error: ${res.status}`)
  return res.json()
}

export async function getAccounts(): Promise<SocialAccount[]> {
  const data = await fetchJSON<{ accounts: SocialAccount[] }>(`${API_BASE}/accounts`)
  return data.accounts
}

export async function triggerSync(platform?: string): Promise<{ autoReplied: number; flagged: number }> {
  return fetchJSON(`${API_BASE}/accounts/sync`, {
    method: 'POST',
    body: JSON.stringify(platform ? { platform } : {}),
  })
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export async function getPosts(params?: { platform?: string; status?: string; limit?: number; page?: number; sort?: string; accountId?: number }): Promise<PaginatedResult<SocialPost>> {
  const query = new URLSearchParams()
  if (params?.platform) query.set('platform', params.platform)
  if (params?.status) query.set('status', params.status)
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.page != null) query.set('page', String(params.page))
  if (params?.sort) query.set('sort', params.sort)
  if (params?.accountId != null) query.set('accountId', String(params.accountId))
  const data = await fetchJSON<{ posts: SocialPost[]; total: number; page: number; pageSize: number }>(`${API_BASE}/posts?${query}`)
  return { items: data.posts, total: data.total, page: data.page, pageSize: data.pageSize }
}

export async function getPost(id: number): Promise<SocialPost> {
  const data = await fetchJSON<{ post: SocialPost }>(`${API_BASE}/posts/${id}`)
  return data.post
}

export async function createPost(post: {
  platform: string; content: string; scheduled_for?: string;
  visibility?: string; first_comment?: string; location?: string; alt_text?: string; labels?: string[];
  media_ids?: number[];
}): Promise<{ id: number }> {
  return fetchJSON(`${API_BASE}/posts`, { method: 'POST', body: JSON.stringify(post) })
}

export async function getComments(params?: { platform?: string; status?: string; limit?: number; page?: number; sort?: string; post_external_id?: string; accountId?: number }): Promise<PaginatedResult<SocialComment>> {
  const query = new URLSearchParams()
  if (params?.platform) query.set('platform', params.platform)
  if (params?.status) query.set('status', params.status)
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.page != null) query.set('page', String(params.page))
  if (params?.sort) query.set('sort', params.sort)
  if (params?.post_external_id) query.set('post_external_id', params.post_external_id)
  if (params?.accountId != null) query.set('accountId', String(params.accountId))
  const data = await fetchJSON<{ comments: SocialComment[]; total: number; page: number; pageSize: number }>(`${API_BASE}/comments?${query}`)
  return { items: data.comments, total: data.total, page: data.page, pageSize: data.pageSize }
}

export async function replyToComment(id: number, reply_content: string, platform?: string, comment_external_id?: string): Promise<void> {
  await fetchJSON(`${API_BASE}/comments/${id}/reply`, { method: 'POST', body: JSON.stringify({ reply_content, platform, comment_external_id }) })
}

export async function getIdeas(params?: { platform?: string; status?: string }): Promise<ContentIdea[]> {
  const query = new URLSearchParams()
  if (params?.platform) query.set('platform', params.platform)
  if (params?.status) query.set('status', params.status)
  const data = await fetchJSON<{ ideas: ContentIdea[] }>(`${API_BASE}/ideas?${query}`)
  return data.ideas
}

export async function generateIdeas(platform: string, count?: number, context?: string): Promise<ContentIdea[]> {
  const data = await fetchJSON<{ ideas: ContentIdea[] }>(`${API_BASE}/ideas/generate`, {
    method: 'POST',
    body: JSON.stringify({ platform, count, context }),
  })
  return data.ideas
}

export async function draftFromIdea(id: number): Promise<string> {
  const data = await fetchJSON<{ draft: string }>(`${API_BASE}/ideas/${id}/draft`, { method: 'POST' })
  return data.draft
}

export async function getRules(platform?: string): Promise<ReplyRule[]> {
  const query = platform ? `?platform=${platform}` : ''
  const data = await fetchJSON<{ rules: ReplyRule[] }>(`${API_BASE}/rules${query}`)
  return data.rules
}

export async function createRule(rule: { platform: string; pattern: string; response_template: string }): Promise<void> {
  await fetchJSON(`${API_BASE}/rules`, { method: 'POST', body: JSON.stringify(rule) })
}

export async function updateRuleApi(id: number, updates: Partial<ReplyRule>): Promise<void> {
  await fetchJSON(`${API_BASE}/rules/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
}

export async function deleteRuleApi(id: number): Promise<void> {
  await fetchJSON(`${API_BASE}/rules/${id}`, { method: 'DELETE' })
}

export async function getInsights(platform: SocialPlatform | 'all' | null = null, days = 30, accountId?: number): Promise<SocialInsights> {
  const query = new URLSearchParams({ days: String(days) })
  if (platform && platform !== 'all') query.set('platform', platform)
  if (accountId != null) query.set('accountId', String(accountId))
  return fetchJSON(`${API_BASE}/insights?${query}`)
}

// --- Media ---

export async function uploadMedia(file: File): Promise<SocialMedia> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/media/upload`, { method: 'POST', body: formData })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  const data = await res.json()
  return data.media
}

export async function getMedia(id: number): Promise<SocialMedia> {
  const data = await fetchJSON<{ media: SocialMedia }>(`${API_BASE}/media/${id}`)
  return data.media
}

export async function analyzeMedia(id: number): Promise<MediaAnalysis> {
  const data = await fetchJSON<{ analysis: MediaAnalysis }>(`${API_BASE}/media/${id}/analyze`, { method: 'POST' })
  return data.analysis
}

export async function deleteMedia(id: number): Promise<void> {
  await fetchJSON(`${API_BASE}/media/${id}`, { method: 'DELETE' })
}

// --- Post management ---

export async function updatePost(id: number, updates: {
  content?: string; scheduled_for?: string | null; media_ids?: number[];
  visibility?: string; first_comment?: string | null; location?: string | null; alt_text?: string | null; labels?: string[] | null;
}): Promise<void> {
  await fetchJSON(`${API_BASE}/posts/${id}`, { method: 'PUT', body: JSON.stringify(updates) })
}

export async function deletePostApi(id: number): Promise<void> {
  await fetchJSON(`${API_BASE}/posts/${id}`, { method: 'DELETE' })
}

export async function publishPost(id: number, platforms?: string[]): Promise<{ success: boolean; results: Array<{ platform: string; externalId?: string; error?: string }> }> {
  return fetchJSON(`${API_BASE}/posts/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(platforms?.length ? { platforms } : {}),
  })
}

// --- AI ---

export async function generateCaption(analysis: MediaAnalysis, style?: string): Promise<CaptionSuggestion> {
  return fetchJSON(`${API_BASE}/ai/caption`, { method: 'POST', body: JSON.stringify({ analysis, style }) })
}

export async function generateFromBrief(opts: {
  brief: string; tone: string; platform: string; language?: string; existingCaption?: string; target: 'caption' | 'first_comment'
}): Promise<{ text: string; hashtags: string[] }> {
  return fetchJSON(`${API_BASE}/ai/generate`, { method: 'POST', body: JSON.stringify(opts) })
}

export async function suggestHashtags(content: string): Promise<string[]> {
  const data = await fetchJSON<{ hashtags: string[] }>(`${API_BASE}/ai/hashtags`, { method: 'POST', body: JSON.stringify({ content }) })
  return data.hashtags
}

export async function getOptimalTime(platform: SocialPlatform): Promise<{ day: string; hour: number; reason: string }> {
  return fetchJSON(`${API_BASE}/ai/optimal-time`, { method: 'POST', body: JSON.stringify({ platform }) })
}

// --- Instagram profile ---

export async function getInstagramProfile(): Promise<{ profile_picture_url: string | null; username: string | null }> {
  return fetchJSON(`${API_BASE}/instagram/profile`)
}

// --- Calendar ---

export async function getCalendarPosts(start: string, end: string, platform?: string, accountId?: number): Promise<SocialPost[]> {
  const query = new URLSearchParams({ start, end })
  if (platform) query.set('platform', platform)
  if (accountId != null) query.set('accountId', String(accountId))
  const data = await fetchJSON<{ posts: SocialPost[] }>(`${API_BASE}/calendar?${query}`)
  return data.posts
}

// --- Workshop ---

export async function getWorkshopBoards(): Promise<WorkshopBoard[]> {
  const data = await fetchJSON<{ boards: WorkshopBoard[] }>(`${API_BASE}/workshop/boards`)
  return data.boards
}

export async function createWorkshopBoard(name: string, platform?: string): Promise<{ id: number }> {
  return fetchJSON(`${API_BASE}/workshop/boards`, {
    method: 'POST',
    body: JSON.stringify({ name, platform }),
  })
}

export async function updateWorkshopBoard(id: number, name: string): Promise<void> {
  await fetchJSON(`${API_BASE}/workshop/boards/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
}

export async function deleteWorkshopBoard(id: number): Promise<void> {
  await fetchJSON(`${API_BASE}/workshop/boards/${id}`, { method: 'DELETE' })
}

export async function getWorkshopCards(boardId: number): Promise<WorkshopCard[]> {
  const data = await fetchJSON<{ cards: WorkshopCard[] }>(`${API_BASE}/workshop/boards/${boardId}/cards`)
  return data.cards
}

export async function createWorkshopCard(boardId: number, card: {
  title: string; description?: string; column_name?: string; tags?: string[]
}): Promise<{ id: number }> {
  return fetchJSON(`${API_BASE}/workshop/boards/${boardId}/cards`, {
    method: 'POST',
    body: JSON.stringify(card),
  })
}

export async function updateWorkshopCard(id: number, updates: {
  title?: string; description?: string; column_name?: string;
  tags?: string[]; notes?: string; position?: number
}): Promise<void> {
  await fetchJSON(`${API_BASE}/workshop/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function deleteWorkshopCard(id: number): Promise<void> {
  await fetchJSON(`${API_BASE}/workshop/cards/${id}`, { method: 'DELETE' })
}

export async function getWorkshopMessages(boardId: number): Promise<WorkshopMessage[]> {
  const data = await fetchJSON<{ messages: WorkshopMessage[] }>(`${API_BASE}/workshop/boards/${boardId}/messages`)
  return data.messages
}

export interface WorkshopChatCallbacks {
  onToken: (token: string) => void
  onCards: (cards: Array<{ title: string; description: string; tags: string[] }>) => void
  onCardUpdated: (id: number) => void
  onDone: () => void
  onError: (error: Error) => void
}

export async function workshopChatStream(
  boardId: number,
  message: string,
  boardName: string,
  platform: string,
  callbacks: WorkshopChatCallbacks
) {
  const res = await fetch(`${API_BASE}/workshop/boards/${boardId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, boardName, platform }),
  })

  if (!res.ok) {
    callbacks.onError(new Error(`Workshop chat error: ${res.status}`))
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    callbacks.onError(new Error('No response body'))
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') {
        callbacks.onDone()
        return
      }
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'token') {
          callbacks.onToken(parsed.content)
        } else if (parsed.type === 'cards') {
          callbacks.onCards(parsed.cards)
        } else if (parsed.type === 'card-updated') {
          callbacks.onCardUpdated(parsed.id)
        }
      } catch {
        // skip malformed lines
      }
    }
  }
  callbacks.onDone()
}
