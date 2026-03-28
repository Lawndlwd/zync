import { z } from 'zod'
import { createDbItem, getDbItems, updateDbItem } from '../../planner/databases.js'
import {
  createCategory,
  createGoal,
  createPage,
  createReminder,
  deletePage,
  getCategories,
  getGoals,
  getPages,
  updateGoal,
  updatePage,
} from '../../planner/db.js'

// Helper: resolve categorySlug -> categoryId
function categoryIdBySlug(slug: string): string | null {
  const cats = getCategories() as { id: string; slug: string }[]
  const found = cats.find((c) => c.slug === slug)
  return found?.id ?? null
}

// --- 1. create_planner_page ---
export const createPlannerPageSchema = z.object({
  categorySlug: z.string().describe('Category slug (e.g. "planning", "finances")'),
  title: z.string().describe('Page title'),
  content: z.string().optional().describe('Page content as JSON string (BlockNote blocks)'),
  icon: z.string().optional().describe('Emoji icon for the page'),
})

export async function createPlannerPageHandler(args: z.infer<typeof createPlannerPageSchema>): Promise<string> {
  try {
    const categoryId = categoryIdBySlug(args.categorySlug)
    if (!categoryId) return JSON.stringify({ success: false, error: `Category "${args.categorySlug}" not found` })
    const page = createPage(categoryId, args.title, {
      icon: args.icon,
      content: args.content,
    })
    return JSON.stringify({ success: true, data: page })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 2. update_planner_page ---
export const updatePlannerPageSchema = z.object({
  pageId: z.string().describe('Page ID'),
  title: z.string().optional().describe('New title'),
  content: z.string().optional().describe('New content as JSON string (BlockNote blocks)'),
})

export async function updatePlannerPageHandler(args: z.infer<typeof updatePlannerPageSchema>): Promise<string> {
  try {
    const updates: Record<string, unknown> = {}
    if (args.title !== undefined) updates.title = args.title
    if (args.content !== undefined) updates.content = args.content
    const page = updatePage(args.pageId, updates)
    if (!page) return JSON.stringify({ success: false, error: 'No fields to update or page not found' })
    return JSON.stringify({ success: true, data: page })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 3. delete_planner_page ---
export const deletePlannerPageSchema = z.object({
  pageId: z.string().describe('Page ID'),
})

export async function deletePlannerPageHandler(args: z.infer<typeof deletePlannerPageSchema>): Promise<string> {
  try {
    const result = deletePage(args.pageId)
    if (!result) return JSON.stringify({ success: false, error: 'Page not found or is a system page' })
    return JSON.stringify({ success: true, data: { deleted: true } })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 4. list_planner_pages ---
export const listPlannerPagesSchema = z.object({
  categorySlug: z.string().optional().describe('Filter by category slug'),
})

export async function listPlannerPagesHandler(args: z.infer<typeof listPlannerPagesSchema>): Promise<string> {
  try {
    let categoryId: string | undefined
    if (args.categorySlug) {
      const id = categoryIdBySlug(args.categorySlug)
      if (!id) return JSON.stringify({ success: false, error: `Category "${args.categorySlug}" not found` })
      categoryId = id
    }
    const pages = getPages(categoryId)
    return JSON.stringify({ success: true, data: pages })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 5. create_planner_category ---
export const createPlannerCategorySchema = z.object({
  name: z.string().describe('Category display name'),
  icon: z.string().optional().describe('Emoji icon'),
  color: z.string().optional().describe('Hex color (e.g. "#f59e0b")'),
})

export async function createPlannerCategoryHandler(args: z.infer<typeof createPlannerCategorySchema>): Promise<string> {
  try {
    const slug = args.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const cat = createCategory(slug, args.name, args.icon || '📁', args.color || '#f59e0b')
    return JSON.stringify({ success: true, data: cat })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 6. create_planner_goal ---
export const createPlannerGoalSchema = z.object({
  categorySlug: z.string().describe('Category slug'),
  title: z.string().describe('Goal title'),
  description: z.string().optional().describe('Goal description'),
  targetDate: z.string().optional().describe('Target date (YYYY-MM-DD)'),
})

export async function createPlannerGoalHandler(args: z.infer<typeof createPlannerGoalSchema>): Promise<string> {
  try {
    const categoryId = categoryIdBySlug(args.categorySlug)
    if (!categoryId) return JSON.stringify({ success: false, error: `Category "${args.categorySlug}" not found` })
    const goal = createGoal(categoryId, args.title, args.description || '', args.targetDate || null)
    return JSON.stringify({ success: true, data: goal })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 7. update_planner_goal ---
export const updatePlannerGoalSchema = z.object({
  goalId: z.string().describe('Goal ID'),
  status: z.string().optional().describe('New status (active, completed, paused)'),
  progress: z.number().optional().describe('Progress percentage (0-100)'),
  title: z.string().optional().describe('New title'),
})

export async function updatePlannerGoalHandler(args: z.infer<typeof updatePlannerGoalSchema>): Promise<string> {
  try {
    const updates: Record<string, unknown> = {}
    if (args.status !== undefined) updates.status = args.status
    if (args.progress !== undefined) updates.progress = args.progress
    if (args.title !== undefined) updates.title = args.title
    const goal = updateGoal(args.goalId, updates)
    if (!goal) return JSON.stringify({ success: false, error: 'No fields to update or goal not found' })
    return JSON.stringify({ success: true, data: goal })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 8. list_planner_goals ---
export const listPlannerGoalsSchema = z.object({
  categorySlug: z.string().optional().describe('Filter by category slug'),
  status: z.string().optional().describe('Filter by status (active, completed, paused)'),
})

export async function listPlannerGoalsHandler(args: z.infer<typeof listPlannerGoalsSchema>): Promise<string> {
  try {
    let categoryId: string | undefined
    if (args.categorySlug) {
      const id = categoryIdBySlug(args.categorySlug)
      if (!id) return JSON.stringify({ success: false, error: `Category "${args.categorySlug}" not found` })
      categoryId = id
    }
    let goals = getGoals(categoryId) as any[]
    if (args.status) {
      goals = goals.filter((g: any) => g.status === args.status)
    }
    return JSON.stringify({ success: true, data: goals })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 9. create_planner_reminder ---
export const createPlannerReminderSchema = z.object({
  title: z.string().describe('Reminder title'),
  dueAt: z.string().describe('Due date/time (ISO 8601, e.g. "2026-03-25T09:00:00")'),
  description: z.string().optional().describe('Reminder description'),
})

export async function createPlannerReminderHandler(args: z.infer<typeof createPlannerReminderSchema>): Promise<string> {
  try {
    const reminder = createReminder(args.title, args.dueAt, {
      description: args.description,
    })
    return JSON.stringify({ success: true, data: reminder })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 10. add_database_item ---
export const addDatabaseItemSchema = z.object({
  databaseId: z.string().describe('Database ID'),
  data: z.record(z.unknown()).describe('Item data as JSON object'),
})

export async function addDatabaseItemHandler(args: z.infer<typeof addDatabaseItemSchema>): Promise<string> {
  try {
    const item = createDbItem(args.databaseId, args.data)
    return JSON.stringify({ success: true, data: item })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 11. update_database_item ---
export const updateDatabaseItemSchema = z.object({
  itemId: z.string().describe('Database item ID'),
  data: z.record(z.unknown()).describe('Updated item data as JSON object'),
})

export async function updateDatabaseItemHandler(args: z.infer<typeof updateDatabaseItemSchema>): Promise<string> {
  try {
    const item = updateDbItem(args.itemId, args.data)
    if (!item) return JSON.stringify({ success: false, error: 'Item not found' })
    return JSON.stringify({ success: true, data: item })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// --- 12. query_database ---
export const queryDatabaseSchema = z.object({
  databaseId: z.string().describe('Database ID'),
})

export async function queryDatabaseHandler(args: z.infer<typeof queryDatabaseSchema>): Promise<string> {
  try {
    const items = getDbItems(args.databaseId)
    return JSON.stringify({ success: true, data: items })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}
