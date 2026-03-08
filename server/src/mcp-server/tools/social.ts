import { z } from 'zod'
import {
  getComments, getPosts, getRules, createRule, updateRule, deleteRule,
  createDraftPost, updateCommentReply,
  getWorkshopBoards, getWorkshopCards, createWorkshopCard, updateWorkshopCard, deleteWorkshopCard,
} from '../../social/db.js'
import { generateContentIdeas } from '../../social/ideas.js'

// --- Schemas ---

export const checkSocialCommentsSchema = z.object({
  platform: z.string().optional().describe('Filter by platform: instagram, x, youtube'),
  status: z.string().optional().describe('Filter by status: pending, flagged, auto_replied, manual_replied'),
  limit: z.number().optional().describe('Max comments to return (default 20)'),
})

export const replySocialCommentSchema = z.object({
  comment_id: z.number().describe('The comment ID to reply to'),
  reply_text: z.string().describe('The reply text'),
})

export const createSocialPostSchema = z.object({
  platform: z.enum(['instagram', 'x', 'youtube']).describe('Target platform'),
  content: z.string().describe('Post content/text'),
  scheduled_for: z.string().optional().describe('ISO datetime to schedule the post (omit for draft)'),
})

export const generateContentIdeasSchema = z.object({
  platform: z.enum(['instagram', 'x', 'youtube']).describe('Target platform'),
  count: z.number().optional().describe('Number of ideas to generate (default 5)'),
  context: z.string().optional().describe('Topic or context hint for idea generation'),
})

export const listSocialPostsSchema = z.object({
  platform: z.string().optional().describe('Filter by platform'),
  status: z.string().optional().describe('Filter by status: draft, scheduled, published'),
  limit: z.number().optional().describe('Max posts to return (default 20)'),
})

export const manageReplyRulesSchema = z.object({
  action: z.enum(['list', 'add', 'update', 'delete']).describe('Action to perform'),
  id: z.number().optional().describe('Rule ID (for update/delete)'),
  platform: z.string().optional().describe('Platform filter or target (default: all)'),
  pattern: z.string().optional().describe('Regex or keyword pattern (for add/update)'),
  response_template: z.string().optional().describe('Response template (for add/update). Use {{ai}} for LLM expansion.'),
  enabled: z.boolean().optional().describe('Enable/disable rule (for update)'),
})

// --- Handlers ---

export async function checkSocialComments(args: z.infer<typeof checkSocialCommentsSchema>): Promise<string> {
  const comments = getComments({
    platform: args.platform,
    status: args.status || 'pending',
    limit: args.limit || 20,
  }) as Array<{ id: number; platform: string; author: string; content: string; reply_status: string; created_at: string }>

  if (comments.length === 0) {
    return `No ${args.status || 'pending'} comments found.`
  }

  const lines = comments.map((c) =>
    `[${c.platform}] #${c.id} by @${c.author} (${c.reply_status}): "${c.content.slice(0, 100)}"`
  )
  return `${comments.length} comments:\n${lines.join('\n')}`
}

export async function replySocialComment(args: z.infer<typeof replySocialCommentSchema>): Promise<string> {
  updateCommentReply(args.comment_id, 'manual_replied', args.reply_text)
  return `Reply saved for comment #${args.comment_id}. Note: The reply is stored and will be posted during the next sync.`
}

export async function createSocialPost(args: z.infer<typeof createSocialPostSchema>): Promise<string> {
  const id = createDraftPost({
    platform: args.platform,
    content: args.content,
    scheduled_for: args.scheduled_for,
  })
  const status = args.scheduled_for ? `scheduled for ${args.scheduled_for}` : 'saved as draft'
  return `Post ${status} on ${args.platform} (ID: ${id})`
}

export async function generateContentIdeasHandler(args: z.infer<typeof generateContentIdeasSchema>): Promise<string> {
  const ideas = await generateContentIdeas(args.platform, args.count || 5, args.context)
  if (ideas.length === 0) return 'No ideas generated.'
  return `Generated ${ideas.length} ideas for ${args.platform}:\n${ideas.map((i, idx) => `${idx + 1}. ${i.idea_text}`).join('\n')}`
}

export async function listSocialPosts(args: z.infer<typeof listSocialPostsSchema>): Promise<string> {
  const posts = getPosts({
    platform: args.platform,
    status: args.status,
    limit: args.limit || 20,
  }) as Array<{ id: number; platform: string; content: string; status: string; posted_at: string | null }>

  if (posts.length === 0) return 'No posts found.'

  const lines = posts.map((p) =>
    `[${p.platform}] #${p.id} (${p.status}): "${p.content.slice(0, 80)}"${p.posted_at ? ` — ${p.posted_at}` : ''}`
  )
  return `${posts.length} posts:\n${lines.join('\n')}`
}

// --- Workshop card schemas ---

export const listWorkshopBoardsSchema = z.object({})

export const listWorkshopCardsSchema = z.object({
  board_id: z.number().describe('The board ID to list cards from'),
})

export const createWorkshopCardSchema = z.object({
  board_id: z.number().describe('The board ID to create the card on'),
  title: z.string().describe('Card title'),
  description: z.string().optional().describe('Card description'),
  column_name: z.string().optional().describe('Column name: ideas, drafting, review, ready, published (default: ideas)'),
  tags: z.array(z.string()).optional().describe('Tags for the card'),
})

export const updateWorkshopCardSchema = z.object({
  card_id: z.number().describe('The card ID to update'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description'),
  column_name: z.string().optional().describe('Move to column: ideas, drafting, review, ready, published'),
  tags: z.array(z.string()).optional().describe('New tags'),
  notes: z.string().optional().describe('AI notes or research to attach to the card'),
})

export const deleteWorkshopCardSchema = z.object({
  card_id: z.number().describe('The card ID to delete'),
})

// --- Workshop card handlers ---

export async function listWorkshopBoardsHandler(): Promise<string> {
  const boards = getWorkshopBoards() as Array<{ id: number; name: string; platform: string; created_at: string }>
  if (boards.length === 0) return 'No workshop boards found.'
  const lines = boards.map((b) => `#${b.id} "${b.name}" (${b.platform}) — created ${b.created_at}`)
  return `${boards.length} boards:\n${lines.join('\n')}`
}

export async function listWorkshopCardsHandler(args: z.infer<typeof listWorkshopCardsSchema>): Promise<string> {
  const cards = getWorkshopCards(args.board_id) as Array<{
    id: number; title: string; description: string; column_name: string; tags: string; notes: string
  }>
  if (cards.length === 0) return `No cards on board #${args.board_id}.`
  const lines = cards.map((c) =>
    `[${c.column_name}] #${c.id} "${c.title}" — ${c.description || '(no description)'}${c.notes ? ` | Notes: ${c.notes.slice(0, 100)}` : ''}`
  )
  return `${cards.length} cards:\n${lines.join('\n')}`
}

export async function createWorkshopCardHandler(args: z.infer<typeof createWorkshopCardSchema>): Promise<string> {
  const id = createWorkshopCard({
    board_id: args.board_id,
    title: args.title,
    description: args.description,
    column_name: args.column_name || 'ideas',
    tags: args.tags ? JSON.stringify(args.tags) : undefined,
  })
  return `Card created (ID: ${id}) in "${args.column_name || 'ideas'}" column on board #${args.board_id}`
}

export async function updateWorkshopCardHandler(args: z.infer<typeof updateWorkshopCardSchema>): Promise<string> {
  updateWorkshopCard(args.card_id, {
    title: args.title,
    description: args.description,
    column_name: args.column_name,
    tags: args.tags ? JSON.stringify(args.tags) : undefined,
    notes: args.notes,
  })
  return `Card #${args.card_id} updated.`
}

export async function deleteWorkshopCardHandler(args: z.infer<typeof deleteWorkshopCardSchema>): Promise<string> {
  deleteWorkshopCard(args.card_id)
  return `Card #${args.card_id} deleted.`
}

export async function manageReplyRules(args: z.infer<typeof manageReplyRulesSchema>): Promise<string> {
  switch (args.action) {
    case 'list': {
      const rules = getRules(args.platform) as Array<{ id: number; platform: string; pattern: string; response_template: string; enabled: number }>
      if (rules.length === 0) return 'No reply rules configured.'
      const lines = rules.map((r) =>
        `#${r.id} [${r.platform}] ${r.enabled ? 'ON' : 'OFF'}: pattern="${r.pattern}" → "${r.response_template.slice(0, 60)}"`
      )
      return `${rules.length} rules:\n${lines.join('\n')}`
    }
    case 'add': {
      if (!args.pattern || !args.response_template) return 'pattern and response_template are required'
      const id = createRule({
        platform: args.platform || 'all',
        pattern: args.pattern,
        response_template: args.response_template,
      })
      return `Rule #${id} created.`
    }
    case 'update': {
      if (!args.id) return 'id is required for update'
      updateRule(args.id, {
        pattern: args.pattern,
        response_template: args.response_template,
        enabled: args.enabled,
      })
      return `Rule #${args.id} updated.`
    }
    case 'delete': {
      if (!args.id) return 'id is required for delete'
      deleteRule(args.id)
      return `Rule #${args.id} deleted.`
    }
  }
}
