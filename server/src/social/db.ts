import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { logger } from '../lib/logger.js'

const DB_PATH = resolve(import.meta.dirname, '../../data/social.db')

let db: Database.Database | null = null

export function getSocialDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initSocialDb(): void {
  const db = getSocialDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_synced TEXT,
      UNIQUE(platform, username)
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      external_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      media_url TEXT,
      posted_at TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      scheduled_for TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(platform, external_id)
    );

    CREATE TABLE IF NOT EXISTS social_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      post_external_id TEXT NOT NULL,
      external_id TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      reply_status TEXT NOT NULL DEFAULT 'pending',
      reply_content TEXT,
      UNIQUE(platform, external_id)
    );

    CREATE TABLE IF NOT EXISTS social_reply_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL DEFAULT 'all',
      pattern TEXT NOT NULL,
      response_template TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS social_content_ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      idea_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idea',
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS social_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      storage_path TEXT NOT NULL,
      thumbnail_path TEXT,
      media_type TEXT NOT NULL DEFAULT 'image',
      analysis TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_social_comments_status ON social_comments(reply_status);
    CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
    CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);

    CREATE TABLE IF NOT EXISTS workshop_boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'general',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workshop_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES workshop_boards(id) ON DELETE CASCADE,
      column_name TEXT NOT NULL DEFAULT 'ideas',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workshop_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES workshop_boards(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_workshop_cards_board ON workshop_cards(board_id);
    CREATE INDEX IF NOT EXISTS idx_workshop_messages_board ON workshop_messages(board_id);

    CREATE TABLE IF NOT EXISTS social_account_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES social_accounts(id),
      date TEXT NOT NULL,
      followers INTEGER DEFAULT 0,
      following INTEGER DEFAULT 0,
      posts_count INTEGER DEFAULT 0,
      profile_views INTEGER DEFAULT 0,
      UNIQUE(account_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_account_date ON social_account_snapshots(account_id, date);
  `)

  // Migration: add sync_cursor column if missing
  const accountCols = db.prepare("PRAGMA table_info(social_accounts)").all() as Array<{ name: string }>
  if (!accountCols.some((c) => c.name === 'sync_cursor')) {
    db.exec('ALTER TABLE social_accounts ADD COLUMN sync_cursor TEXT')
    logger.info('Added sync_cursor column to social_accounts')
  }

  // Migration: add engagement columns to social_posts
  const postCols = db.prepare("PRAGMA table_info(social_posts)").all() as Array<{ name: string }>
  if (!postCols.some((c) => c.name === 'like_count')) {
    db.exec('ALTER TABLE social_posts ADD COLUMN like_count INTEGER DEFAULT 0')
    db.exec('ALTER TABLE social_posts ADD COLUMN comments_count INTEGER DEFAULT 0')
    db.exec('ALTER TABLE social_posts ADD COLUMN permalink TEXT')
    logger.info('Added engagement columns to social_posts')
  }

  // Migration: add media_ids column to social_posts
  if (!postCols.some((c) => c.name === 'media_ids')) {
    db.exec("ALTER TABLE social_posts ADD COLUMN media_ids TEXT DEFAULT '[]'")
    logger.info('Added media_ids column to social_posts')
  }

  // Migration: add composer fields (visibility, first_comment, location, alt_text, labels)
  if (!postCols.some((c) => c.name === 'visibility')) {
    db.exec("ALTER TABLE social_posts ADD COLUMN visibility TEXT DEFAULT 'public'")
    db.exec("ALTER TABLE social_posts ADD COLUMN first_comment TEXT")
    db.exec("ALTER TABLE social_posts ADD COLUMN location TEXT")
    db.exec("ALTER TABLE social_posts ADD COLUMN alt_text TEXT")
    db.exec("ALTER TABLE social_posts ADD COLUMN labels TEXT")
    logger.info('Added composer fields to social_posts')
  }

  // Migration: add account_id to posts and comments
  if (!postCols.some((c) => c.name === 'account_id')) {
    db.exec('ALTER TABLE social_posts ADD COLUMN account_id INTEGER REFERENCES social_accounts(id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_posts_account ON social_posts(account_id)')
    logger.info('Added account_id to social_posts')
  }
  // Migration: add rich metrics columns to social_posts
  if (!postCols.some((c) => c.name === 'reach')) {
    db.exec('ALTER TABLE social_posts ADD COLUMN reach INTEGER DEFAULT 0')
    db.exec('ALTER TABLE social_posts ADD COLUMN impressions INTEGER DEFAULT 0')
    db.exec('ALTER TABLE social_posts ADD COLUMN shares_count INTEGER DEFAULT 0')
    db.exec('ALTER TABLE social_posts ADD COLUMN saves_count INTEGER DEFAULT 0')
    db.exec('ALTER TABLE social_posts ADD COLUMN video_views INTEGER DEFAULT 0')
    db.exec('ALTER TABLE social_posts ADD COLUMN clicks INTEGER DEFAULT 0')
    logger.info('Added reach/impressions/shares/saves/video_views/clicks to social_posts')
  }

  const commentCols = db.prepare("PRAGMA table_info(social_comments)").all() as Array<{ name: string }>
  if (!commentCols.some((c) => c.name === 'account_id')) {
    db.exec('ALTER TABLE social_comments ADD COLUMN account_id INTEGER REFERENCES social_accounts(id)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_comments_account ON social_comments(account_id)')
    logger.info('Added account_id to social_comments')
  }

  logger.info('Social database initialized')
}

// --- Account helpers ---

export function upsertAccount(platform: string, username: string) {
  const db = getSocialDb()
  db.prepare(`
    INSERT INTO social_accounts (platform, username) VALUES (?, ?)
    ON CONFLICT(platform, username) DO UPDATE SET status = 'active'
  `).run(platform, username)
}

export function getAccounts() {
  return getSocialDb().prepare('SELECT * FROM social_accounts ORDER BY platform').all()
}

export function updateAccountSync(platform: string, username: string) {
  getSocialDb().prepare(`
    UPDATE social_accounts SET last_synced = datetime('now') WHERE platform = ? AND username = ?
  `).run(platform, username)
}

export function getAccountSyncCursor(platform: string, username: string): string | null {
  const row = getSocialDb().prepare(
    'SELECT sync_cursor FROM social_accounts WHERE platform = ? AND username = ?'
  ).get(platform, username) as { sync_cursor: string | null } | undefined
  return row?.sync_cursor ?? null
}

export function updateAccountSyncCursor(platform: string, username: string, cursor: string | null) {
  getSocialDb().prepare(
    'UPDATE social_accounts SET sync_cursor = ? WHERE platform = ? AND username = ?'
  ).run(cursor, platform, username)
}

// --- Account snapshot helpers ---

export function upsertAccountSnapshot(accountId: number, data: { followers: number; following?: number; posts_count?: number; profile_views?: number }) {
  const db = getSocialDb()
  const today = new Date().toISOString().split('T')[0]
  db.prepare(`
    INSERT INTO social_account_snapshots (account_id, date, followers, following, posts_count, profile_views)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, date) DO UPDATE SET
      followers = excluded.followers, following = excluded.following,
      posts_count = excluded.posts_count, profile_views = excluded.profile_views
  `).run(accountId, today, data.followers, data.following ?? 0, data.posts_count ?? 0, data.profile_views ?? 0)
}

export function getAccountSnapshots(accountId: number | undefined, startDate: string, endDate: string) {
  const db = getSocialDb()
  if (accountId) {
    return db.prepare('SELECT * FROM social_account_snapshots WHERE account_id = ? AND date BETWEEN ? AND ? ORDER BY date').all(accountId, startDate, endDate)
  }
  return db.prepare(`
    SELECT date, SUM(followers) as followers, SUM(following) as following, SUM(posts_count) as posts_count, SUM(profile_views) as profile_views
    FROM social_account_snapshots WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date
  `).all(startDate, endDate)
}

// --- Post helpers ---

export function upsertPost(post: {
  platform: string
  external_id: string
  content: string
  media_url?: string | null
  posted_at?: string | null
  status?: string
  like_count?: number
  comments_count?: number
  permalink?: string | null
  account_id?: number | null
  reach?: number
  impressions?: number
  shares_count?: number
  saves_count?: number
  video_views?: number
  clicks?: number
}) {
  const db = getSocialDb()
  db.prepare(`
    INSERT INTO social_posts (platform, external_id, content, media_url, posted_at, status, like_count, comments_count, permalink, account_id, reach, impressions, shares_count, saves_count, video_views, clicks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, external_id) DO UPDATE SET
      content = excluded.content,
      media_url = excluded.media_url,
      posted_at = excluded.posted_at,
      like_count = excluded.like_count,
      comments_count = excluded.comments_count,
      permalink = excluded.permalink,
      account_id = excluded.account_id,
      reach = excluded.reach,
      impressions = excluded.impressions,
      shares_count = excluded.shares_count,
      saves_count = excluded.saves_count,
      video_views = excluded.video_views,
      clicks = excluded.clicks
  `).run(post.platform, post.external_id, post.content, post.media_url ?? null, post.posted_at ?? null, post.status ?? 'published', post.like_count ?? 0, post.comments_count ?? 0, post.permalink ?? null, post.account_id ?? null, post.reach ?? 0, post.impressions ?? 0, post.shares_count ?? 0, post.saves_count ?? 0, post.video_views ?? 0, post.clicks ?? 0)
}

export function createDraftPost(post: {
  platform: string
  content: string
  scheduled_for?: string | null
  visibility?: string
  first_comment?: string | null
  location?: string | null
  alt_text?: string | null
  labels?: string | null
  media_ids?: string | null
  account_id?: number | null
}) {
  const db = getSocialDb()
  const status = post.scheduled_for ? 'scheduled' : 'draft'
  const externalId = `draft_${Date.now()}`
  const result = db.prepare(`
    INSERT INTO social_posts (platform, external_id, content, status, scheduled_for, visibility, first_comment, location, alt_text, labels, media_ids, account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    post.platform, externalId, post.content, status,
    post.scheduled_for ?? null,
    post.visibility ?? 'public',
    post.first_comment ?? null,
    post.location ?? null,
    post.alt_text ?? null,
    post.labels ?? null,
    post.media_ids ?? '[]',
    post.account_id ?? null,
  )
  return result.lastInsertRowid
}

const postSortColumns: Record<string, string> = {
  recent: 'COALESCE(posted_at, created_at) DESC',
  oldest: 'COALESCE(posted_at, created_at) ASC',
  most_likes: 'like_count DESC',
  most_comments: 'comments_count DESC',
  most_engagement: '(like_count + comments_count) DESC',
}

export function getPosts(filters?: { platform?: string; status?: string; limit?: number; offset?: number; sort?: string; accountId?: number }) {
  const db = getSocialDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.platform) {
    conditions.push('platform = ?')
    params.push(filters.platform)
  }
  if (filters?.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }
  if (filters?.accountId != null) {
    conditions.push('account_id = ?')
    params.push(filters.accountId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = postSortColumns[filters?.sort ?? ''] ?? 'COALESCE(posted_at, created_at) DESC'
  const limit = filters?.limit ?? 50
  const offset = filters?.offset ?? 0
  const allParams = [...params, limit, offset]
  return db.prepare(`SELECT * FROM social_posts ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...allParams)
}

export function countPosts(filters?: { platform?: string; status?: string; accountId?: number }): number {
  const db = getSocialDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.platform) {
    conditions.push('platform = ?')
    params.push(filters.platform)
  }
  if (filters?.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }
  if (filters?.accountId != null) {
    conditions.push('account_id = ?')
    params.push(filters.accountId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const row = db.prepare(`SELECT COUNT(*) as count FROM social_posts ${where}`).get(...params) as { count: number }
  return row.count
}

export function getScheduledPostsDue() {
  return getSocialDb().prepare(`
    SELECT * FROM social_posts
    WHERE status = 'scheduled' AND scheduled_for <= datetime('now')
    ORDER BY scheduled_for ASC
  `).all()
}

export function updatePostStatus(id: number, status: string, externalId?: string) {
  const db = getSocialDb()
  if (externalId) {
    db.prepare('UPDATE social_posts SET status = ?, external_id = ? WHERE id = ?').run(status, externalId, id)
  } else {
    db.prepare('UPDATE social_posts SET status = ? WHERE id = ?').run(status, id)
  }
}

// --- Comment helpers ---

export function upsertComment(comment: {
  platform: string
  post_external_id: string
  external_id: string
  author: string
  content: string
  created_at?: string
  account_id?: number | null
}) {
  const db = getSocialDb()
  db.prepare(`
    INSERT INTO social_comments (platform, post_external_id, external_id, author, content, created_at, account_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform, external_id) DO UPDATE SET
      content = excluded.content,
      author = excluded.author,
      account_id = excluded.account_id
  `).run(comment.platform, comment.post_external_id, comment.external_id, comment.author, comment.content, comment.created_at ?? new Date().toISOString(), comment.account_id ?? null)
}

const commentSortColumns: Record<string, string> = {
  recent: 'created_at DESC',
  oldest: 'created_at ASC',
}
// Note: comments only have created_at, which is the comment timestamp — correct for sorting

export function getComments(filters?: { platform?: string; status?: string; post_external_id?: string; limit?: number; offset?: number; sort?: string; accountId?: number }) {
  const db = getSocialDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.platform) {
    conditions.push('platform = ?')
    params.push(filters.platform)
  }
  if (filters?.status) {
    conditions.push('reply_status = ?')
    params.push(filters.status)
  }
  if (filters?.post_external_id) {
    conditions.push('post_external_id = ?')
    params.push(filters.post_external_id)
  }
  if (filters?.accountId != null) {
    conditions.push('account_id = ?')
    params.push(filters.accountId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const orderBy = commentSortColumns[filters?.sort ?? ''] ?? 'created_at DESC'
  const limit = filters?.limit ?? 100
  const offset = filters?.offset ?? 0
  const allParams = [...params, limit, offset]
  return db.prepare(`SELECT * FROM social_comments ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...allParams)
}

export function countComments(filters?: { platform?: string; status?: string; post_external_id?: string; accountId?: number }): number {
  const db = getSocialDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.platform) {
    conditions.push('platform = ?')
    params.push(filters.platform)
  }
  if (filters?.status) {
    conditions.push('reply_status = ?')
    params.push(filters.status)
  }
  if (filters?.post_external_id) {
    conditions.push('post_external_id = ?')
    params.push(filters.post_external_id)
  }
  if (filters?.accountId != null) {
    conditions.push('account_id = ?')
    params.push(filters.accountId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const row = db.prepare(`SELECT COUNT(*) as count FROM social_comments ${where}`).get(...params) as { count: number }
  return row.count
}

export function getPendingComments() {
  return getSocialDb().prepare(`
    SELECT * FROM social_comments WHERE reply_status = 'pending' ORDER BY created_at ASC
  `).all()
}

export function updateCommentReply(id: number, status: string, replyContent?: string) {
  getSocialDb().prepare(`
    UPDATE social_comments SET reply_status = ?, reply_content = ? WHERE id = ?
  `).run(status, replyContent ?? null, id)
}

// --- Reply rule helpers ---

export function getRules(platform?: string) {
  const db = getSocialDb()
  if (platform) {
    return db.prepare("SELECT * FROM social_reply_rules WHERE platform = ? OR platform = 'all' ORDER BY id").all(platform)
  }
  return db.prepare('SELECT * FROM social_reply_rules ORDER BY id').all()
}

export function createRule(rule: { platform: string; pattern: string; response_template: string }) {
  const db = getSocialDb()
  const result = db.prepare(`
    INSERT INTO social_reply_rules (platform, pattern, response_template) VALUES (?, ?, ?)
  `).run(rule.platform, rule.pattern, rule.response_template)
  return result.lastInsertRowid
}

export function updateRule(id: number, updates: { pattern?: string; response_template?: string; enabled?: boolean }) {
  const db = getSocialDb()
  const sets: string[] = []
  const params: any[] = []

  if (updates.pattern !== undefined) { sets.push('pattern = ?'); params.push(updates.pattern) }
  if (updates.response_template !== undefined) { sets.push('response_template = ?'); params.push(updates.response_template) }
  if (updates.enabled !== undefined) { sets.push('enabled = ?'); params.push(updates.enabled ? 1 : 0) }

  if (sets.length === 0) return
  params.push(id)
  db.prepare(`UPDATE social_reply_rules SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function deleteRule(id: number) {
  getSocialDb().prepare('DELETE FROM social_reply_rules WHERE id = ?').run(id)
}

// --- Content idea helpers ---

export function getIdeas(filters?: { platform?: string; status?: string; limit?: number }) {
  const db = getSocialDb()
  const conditions: string[] = []
  const params: any[] = []

  if (filters?.platform) {
    conditions.push('platform = ?')
    params.push(filters.platform)
  }
  if (filters?.status) {
    conditions.push('status = ?')
    params.push(filters.status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters?.limit ?? 50
  return db.prepare(`SELECT * FROM social_content_ideas ${where} ORDER BY generated_at DESC LIMIT ?`).all(...params, limit)
}

export function insertIdea(platform: string, ideaText: string) {
  const db = getSocialDb()
  const result = db.prepare(`
    INSERT INTO social_content_ideas (platform, idea_text) VALUES (?, ?)
  `).run(platform, ideaText)
  return result.lastInsertRowid
}

export function updateIdeaStatus(id: number, status: string) {
  getSocialDb().prepare('UPDATE social_content_ideas SET status = ? WHERE id = ?').run(status, id)
}

// --- Insights / analytics ---

export interface SocialInsightsData {
  engagementOverTime: Array<{ date: string; likes: number; comments: number }>
  postFrequency: Array<{ week: string; count: number }>
  topPosts: Array<{ external_id: string; content: string; permalink: string | null; engagement: number; like_count: number; comments_count: number }>
  commentStatusBreakdown: Array<{ status: string; count: number }>
  postingHeatmap: Array<{ day_of_week: number; hour: number; avg_engagement: number }>
  growthOverTime: Array<{ date: string; cumulative_likes: number; cumulative_comments: number }>
}

export function getInsights(platform: string, days: number, accountId?: number): SocialInsightsData {
  const db = getSocialDb()
  // Compute the cutoff date as a plain string to avoid format mismatch with ISO8601 posted_at
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString()

  // Use COALESCE to handle NULL posted_at, and datetime() to normalize ISO8601 for date functions
  const dateFn = "date(COALESCE(posted_at, created_at))"

  // Optional account filter
  const accountFilter = accountId != null ? ' AND account_id = ?' : ''
  const accountParam = accountId != null ? [accountId] : []

  // 1. Engagement over time — daily likes + comments
  const engagementOverTime = db.prepare(`
    SELECT ${dateFn} as post_date,
           COALESCE(SUM(like_count), 0) as likes,
           COALESCE(SUM(comments_count), 0) as comments
    FROM social_posts
    WHERE platform = ? AND COALESCE(posted_at, created_at) >= ?${accountFilter}
    GROUP BY post_date
    ORDER BY post_date
  `).all(platform, cutoff, ...accountParam) as Array<{ post_date: string; likes: number; comments: number }>
  const engagementMapped = engagementOverTime.map(r => ({ date: r.post_date, likes: r.likes, comments: r.comments }))

  // 2. Post frequency — posts per week
  const postFrequency = db.prepare(`
    SELECT strftime('%Y-W%W', COALESCE(posted_at, created_at)) as week,
           COUNT(*) as count
    FROM social_posts
    WHERE platform = ? AND COALESCE(posted_at, created_at) >= ?${accountFilter}
    GROUP BY week
    ORDER BY week
  `).all(platform, cutoff, ...accountParam) as SocialInsightsData['postFrequency']

  // 3. Top posts — top 10 by engagement (no date filter — show best ever)
  const topPosts = db.prepare(`
    SELECT external_id, content, permalink,
           (COALESCE(like_count, 0) + COALESCE(comments_count, 0)) as engagement,
           COALESCE(like_count, 0) as like_count,
           COALESCE(comments_count, 0) as comments_count
    FROM social_posts
    WHERE platform = ?${accountFilter}
    ORDER BY engagement DESC
    LIMIT 10
  `).all(platform, ...accountParam) as SocialInsightsData['topPosts']

  // 4. Comment status breakdown (no date filter — show all)
  const commentStatusBreakdown = db.prepare(`
    SELECT reply_status as status, COUNT(*) as count
    FROM social_comments
    WHERE platform = ?${accountFilter}
    GROUP BY reply_status
  `).all(platform, ...accountParam) as SocialInsightsData['commentStatusBreakdown']

  // 5. Posting time heatmap — day_of_week x hour with avg engagement
  const postingHeatmap = db.prepare(`
    SELECT CAST(strftime('%w', COALESCE(posted_at, created_at)) AS INTEGER) as day_of_week,
           CAST(strftime('%H', COALESCE(posted_at, created_at)) AS INTEGER) as hour,
           AVG(COALESCE(like_count, 0) + COALESCE(comments_count, 0)) as avg_engagement
    FROM social_posts
    WHERE platform = ? AND posted_at IS NOT NULL${accountFilter}
    GROUP BY day_of_week, hour
  `).all(platform, ...accountParam) as SocialInsightsData['postingHeatmap']

  // 6. Growth metrics — cumulative totals over time
  const growthOverTime = db.prepare(`
    SELECT post_date as date, cumulative_likes, cumulative_comments FROM (
      SELECT ${dateFn} as post_date,
             SUM(SUM(COALESCE(like_count, 0))) OVER (ORDER BY ${dateFn}) as cumulative_likes,
             SUM(SUM(COALESCE(comments_count, 0))) OVER (ORDER BY ${dateFn}) as cumulative_comments
      FROM social_posts
      WHERE platform = ? AND COALESCE(posted_at, created_at) >= ?${accountFilter}
      GROUP BY post_date
    )
    ORDER BY date
  `).all(platform, cutoff, ...accountParam) as SocialInsightsData['growthOverTime']

  return { engagementOverTime: engagementMapped, postFrequency, topPosts, commentStatusBreakdown, postingHeatmap, growthOverTime }
}

// --- Media helpers ---

export interface MediaRecord {
  id: number
  filename: string
  original_name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  thumbnail_path: string | null
  media_type: string
  analysis: string | null
  created_at: string
}

export function insertMedia(media: Omit<MediaRecord, 'id' | 'created_at' | 'analysis' | 'thumbnail_path'> & { thumbnail_path?: string | null }): number | bigint {
  const db = getSocialDb()
  const result = db.prepare(`
    INSERT INTO social_media (filename, original_name, mime_type, size_bytes, storage_path, thumbnail_path, media_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(media.filename, media.original_name, media.mime_type, media.size_bytes, media.storage_path, media.thumbnail_path ?? null, media.media_type)
  return result.lastInsertRowid
}

export function getMediaById(id: number): MediaRecord | undefined {
  return getSocialDb().prepare('SELECT * FROM social_media WHERE id = ?').get(id) as MediaRecord | undefined
}

export function updateMediaAnalysis(id: number, analysis: string): void {
  getSocialDb().prepare('UPDATE social_media SET analysis = ? WHERE id = ?').run(analysis, id)
}

export function deleteMediaRecord(id: number): void {
  getSocialDb().prepare('DELETE FROM social_media WHERE id = ?').run(id)
}

export function getPostById(id: number) {
  return getSocialDb().prepare('SELECT * FROM social_posts WHERE id = ?').get(id) as any | undefined
}

export function updatePost(id: number, updates: {
  content?: string; scheduled_for?: string | null; media_ids?: string; status?: string;
  visibility?: string; first_comment?: string | null; location?: string | null; alt_text?: string | null; labels?: string | null;
}): void {
  const db = getSocialDb()
  const sets: string[] = []
  const params: any[] = []

  if (updates.content !== undefined) { sets.push('content = ?'); params.push(updates.content) }
  if (updates.scheduled_for !== undefined) { sets.push('scheduled_for = ?'); params.push(updates.scheduled_for) }
  if (updates.media_ids !== undefined) { sets.push('media_ids = ?'); params.push(updates.media_ids) }
  if (updates.status !== undefined) { sets.push('status = ?'); params.push(updates.status) }
  if (updates.visibility !== undefined) { sets.push('visibility = ?'); params.push(updates.visibility) }
  if (updates.first_comment !== undefined) { sets.push('first_comment = ?'); params.push(updates.first_comment) }
  if (updates.location !== undefined) { sets.push('location = ?'); params.push(updates.location) }
  if (updates.alt_text !== undefined) { sets.push('alt_text = ?'); params.push(updates.alt_text) }
  if (updates.labels !== undefined) { sets.push('labels = ?'); params.push(updates.labels) }

  if (sets.length === 0) return
  params.push(id)
  db.prepare(`UPDATE social_posts SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function deletePost(id: number): void {
  getSocialDb().prepare('DELETE FROM social_posts WHERE id = ?').run(id)
}

export function getCalendarPosts(start: string, end: string, platform?: string, accountId?: number) {
  const db = getSocialDb()
  const conditions = ["(COALESCE(scheduled_for, posted_at, created_at) BETWEEN ? AND ?)"]
  const params: any[] = [start, end]
  if (platform) {
    conditions.push('platform = ?')
    params.push(platform)
  }
  if (accountId != null) {
    conditions.push('account_id = ?')
    params.push(accountId)
  }
  return db.prepare(`SELECT * FROM social_posts WHERE ${conditions.join(' AND ')} ORDER BY COALESCE(scheduled_for, posted_at, created_at)`).all(...params)
}

// --- Workshop helpers ---

export function getWorkshopBoards() {
  return getSocialDb().prepare('SELECT * FROM workshop_boards ORDER BY created_at DESC').all()
}

export function createWorkshopBoard(name: string, platform = 'general') {
  const result = getSocialDb().prepare(
    'INSERT INTO workshop_boards (name, platform) VALUES (?, ?)'
  ).run(name, platform)
  return result.lastInsertRowid
}

export function updateWorkshopBoard(id: number, name: string) {
  getSocialDb().prepare('UPDATE workshop_boards SET name = ? WHERE id = ?').run(name, id)
}

export function deleteWorkshopBoard(id: number) {
  getSocialDb().prepare('DELETE FROM workshop_boards WHERE id = ?').run(id)
}

export function getWorkshopCards(boardId: number) {
  return getSocialDb().prepare(
    'SELECT * FROM workshop_cards WHERE board_id = ? ORDER BY position ASC'
  ).all(boardId)
}

export function createWorkshopCard(card: {
  board_id: number; title: string; description?: string;
  column_name?: string; tags?: string; notes?: string; position?: number
}) {
  const maxPos = getSocialDb().prepare(
    'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM workshop_cards WHERE board_id = ? AND column_name = ?'
  ).get(card.board_id, card.column_name ?? 'ideas') as { next_pos: number }
  const result = getSocialDb().prepare(
    'INSERT INTO workshop_cards (board_id, title, description, column_name, tags, notes, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    card.board_id, card.title, card.description ?? '', card.column_name ?? 'ideas',
    card.tags ?? '[]', card.notes ?? '', card.position ?? maxPos.next_pos
  )
  return result.lastInsertRowid
}

export function updateWorkshopCard(id: number, updates: {
  title?: string; description?: string; column_name?: string;
  tags?: string; notes?: string; position?: number
}) {
  const db = getSocialDb()
  const sets: string[] = []
  const params: any[] = []
  if (updates.title !== undefined) { sets.push('title = ?'); params.push(updates.title) }
  if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description) }
  if (updates.column_name !== undefined) { sets.push('column_name = ?'); params.push(updates.column_name) }
  if (updates.tags !== undefined) { sets.push('tags = ?'); params.push(updates.tags) }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes) }
  if (updates.position !== undefined) { sets.push('position = ?'); params.push(updates.position) }
  if (sets.length === 0) return
  params.push(id)
  db.prepare(`UPDATE workshop_cards SET ${sets.join(', ')} WHERE id = ?`).run(...params)
}

export function deleteWorkshopCard(id: number) {
  getSocialDb().prepare('DELETE FROM workshop_cards WHERE id = ?').run(id)
}

export function getWorkshopMessages(boardId: number, limit = 100) {
  return getSocialDb().prepare(
    'SELECT * FROM workshop_messages WHERE board_id = ? ORDER BY created_at ASC LIMIT ?'
  ).all(boardId, limit)
}

export function insertWorkshopMessage(boardId: number, role: string, content: string) {
  const result = getSocialDb().prepare(
    'INSERT INTO workshop_messages (board_id, role, content) VALUES (?, ?, ?)'
  ).run(boardId, role, content)
  return result.lastInsertRowid
}
