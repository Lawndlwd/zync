export type SocialPlatform = 'instagram' | 'x' | 'youtube'

export type AccountStatus = 'active' | 'paused'
export type PostStatus = 'draft' | 'scheduled' | 'published'
export type ReplyStatus = 'pending' | 'auto_replied' | 'flagged' | 'manual_replied'
export type IdeaStatus = 'idea' | 'drafted' | 'used'

export interface SocialAccount {
  id: number
  platform: SocialPlatform
  username: string
  status: AccountStatus
  last_synced: string | null
}

export type PostVisibility = 'public' | 'private' | 'close_friends' | 'unlisted'

export interface SocialPost {
  id: number
  platform: SocialPlatform
  external_id: string
  content: string
  media_url: string | null
  media_ids: string | null
  posted_at: string | null
  status: PostStatus
  scheduled_for: string | null
  created_at: string
  like_count: number
  comments_count: number
  permalink: string | null
  visibility: PostVisibility
  first_comment: string | null
  location: string | null
  alt_text: string | null
  labels: string | null
  account_id?: number
}

export interface SocialComment {
  id: number
  platform: SocialPlatform
  post_external_id: string
  external_id: string
  author: string
  content: string
  created_at: string
  reply_status: ReplyStatus
  reply_content: string | null
  account_id?: number
}

export interface ReplyRule {
  id: number
  platform: SocialPlatform | 'all'
  pattern: string
  response_template: string
  enabled: boolean
}

export interface ContentIdea {
  id: number
  platform: SocialPlatform
  idea_text: string
  status: IdeaStatus
  generated_at: string
}

export interface SocialMedia {
  id: number
  filename: string
  original_name: string
  mime_type: string
  size_bytes: number
  storage_path: string
  thumbnail_path: string | null
  media_type: 'image' | 'video'
  analysis: MediaAnalysis | null
  created_at: string
}

export interface MediaAnalysis {
  composition: string
  filterSuggestions: string[]
  captionIdeas: string[]
  hashtags: string[]
  mood: string
  keyMoments?: string[]
  trimSuggestions?: string
}

export interface CaptionSuggestion {
  caption: string
  hashtags: string[]
  estimatedReach: string
}

export interface CalendarPost extends SocialPost {
  dateKey: string
}

export interface SocialFeatures {
  contentComposer: boolean
  unifiedInbox: boolean
  analytics: boolean
  contentCalendar: boolean
  autoReply: boolean
  aiSuggestions: boolean
}

// --- Workshop types ---

export type WorkshopColumn = 'ideas' | 'review' | 'ready'

export interface WorkshopBoard {
  id: number
  name: string
  platform: string
  created_at: string
}

export interface WorkshopCard {
  id: number
  board_id: number
  column_name: WorkshopColumn
  title: string
  description: string
  tags: string
  notes: string
  position: number
  created_at: string
}

export interface WorkshopMessage {
  id: number
  board_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
