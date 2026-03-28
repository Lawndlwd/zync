import { z } from 'zod'
import {
  createDailyLever,
  createLifeOsComponent,
  getDailyLevers,
  getIdentity,
  getJournalEntries,
  getJournalEntry,
  getLifeOsComponentByType,
  getLifeOsComponents,
  getLifeOsStats,
  toggleDailyLever,
  updateLifeOsComponent,
  upsertIdentity,
} from '../../planner/db.js'
import {
  createGoal,
  getGoal,
  getGoalChildren,
  getGoalRoots,
  scaffoldChildren,
  updateGoal,
} from '../../planner/goals.js'

// ---------- Identity ----------

export const getIdentitySchema = z.object({})

export async function getIdentityHandler(): Promise<string> {
  const identity = getIdentity()
  return JSON.stringify({ success: true, data: identity || null })
}

export const setIdentitySchema = z.object({
  statement: z.string().describe('Identity statement — who you are becoming (e.g. "I am the type of person who...")'),
})

export async function setIdentityHandler(args: z.infer<typeof setIdentitySchema>): Promise<string> {
  const result = upsertIdentity(args.statement)
  return JSON.stringify({ success: true, data: result })
}

// ---------- Game Board Components ----------

export const listComponentsSchema = z.object({})

export async function listComponentsHandler(): Promise<string> {
  return JSON.stringify({ success: true, data: getLifeOsComponents() })
}

export const setComponentSchema = z.object({
  type: z
    .enum(['anti-vision', 'vision', 'one-year-goal', 'one-month-project', 'constraints'])
    .describe('Component type'),
  title: z.string().describe('Component title'),
  content: z.string().default('').describe('Component content/description'),
  targetDate: z.string().optional().describe('Target date (YYYY-MM-DD)'),
})

export async function setComponentHandler(args: z.infer<typeof setComponentSchema>): Promise<string> {
  try {
    // Check if active component of this type exists — update it; otherwise create
    const existing = getLifeOsComponentByType(args.type) as { id: string } | undefined
    if (existing) {
      const updates: Record<string, unknown> = { title: args.title, content: args.content }
      if (args.targetDate) updates.target_date = args.targetDate
      const updated = updateLifeOsComponent(existing.id, updates)
      return JSON.stringify({ success: true, data: updated, action: 'updated' })
    }
    const created = createLifeOsComponent(args.type, args.title, args.content, {
      targetDate: args.targetDate,
    })
    return JSON.stringify({ success: true, data: created, action: 'created' })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// ---------- Life OS Goals (fractal: year → month → week → day) ----------

export const listGoalsSchema = z.object({
  status: z.enum(['active', 'completed', 'abandoned']).optional().describe('Filter by status'),
})

export async function listGoalsHandler(args: z.infer<typeof listGoalsSchema>): Promise<string> {
  return JSON.stringify({ success: true, data: getGoalRoots(args.status) })
}

export const getGoalSchema = z.object({
  goalId: z.string().describe('Goal ID'),
})

export async function getGoalHandler(args: z.infer<typeof getGoalSchema>): Promise<string> {
  const goal = getGoal(args.goalId)
  if (!goal) return JSON.stringify({ success: false, error: 'Goal not found' })
  const children = getGoalChildren(args.goalId)
  return JSON.stringify({ success: true, data: { ...goal, children } })
}

export const createGoalSchema = z.object({
  title: z.string().describe('Goal title'),
  granularity: z.enum(['year', 'month', 'week', 'day']).describe('Goal granularity level'),
  startDate: z.string().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().describe('End date (YYYY-MM-DD)'),
  parentId: z.string().optional().describe('Parent goal ID (for sub-goals)'),
})

export async function createGoalHandler(args: z.infer<typeof createGoalSchema>): Promise<string> {
  try {
    const goal = createGoal(args.granularity, args.title, args.startDate, args.endDate, {
      parentId: args.parentId,
    })
    return JSON.stringify({ success: true, data: goal })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

export const updateGoalSchema = z.object({
  goalId: z.string().describe('Goal ID'),
  title: z.string().optional().describe('New title'),
  status: z.enum(['active', 'completed', 'abandoned']).optional().describe('New status'),
  progress: z.number().optional().describe('Progress 0-100'),
})

export async function updateGoalHandler(args: z.infer<typeof updateGoalSchema>): Promise<string> {
  try {
    const updates: Record<string, unknown> = {}
    if (args.title !== undefined) updates.title = args.title
    if (args.status !== undefined) updates.status = args.status
    if (args.progress !== undefined) updates.progress = args.progress
    const goal = updateGoal(args.goalId, updates)
    if (!goal) return JSON.stringify({ success: false, error: 'Goal not found' })
    return JSON.stringify({ success: true, data: goal })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

export const scaffoldGoalSchema = z.object({
  goalId: z.string().describe('Parent goal ID — auto-generates children (year→months, month→weeks, week→days)'),
})

export async function scaffoldGoalHandler(args: z.infer<typeof scaffoldGoalSchema>): Promise<string> {
  try {
    const children = scaffoldChildren(args.goalId)
    return JSON.stringify({ success: true, count: children.length, data: children })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// ---------- Daily Levers ----------

export const listLeversSchema = z.object({
  date: z.string().optional().describe('Date (YYYY-MM-DD), defaults to today'),
})

export async function listLeversHandler(args: z.infer<typeof listLeversSchema>): Promise<string> {
  const date = args.date || new Date().toISOString().slice(0, 10)
  return JSON.stringify({ success: true, data: getDailyLevers(date) })
}

export const createLeverSchema = z.object({
  title: z.string().describe('Lever title — a priority action for the day'),
  date: z.string().optional().describe('Date (YYYY-MM-DD), defaults to today'),
  projectId: z.string().optional().describe('Linked 1-month project component ID'),
})

export async function createLeverHandler(args: z.infer<typeof createLeverSchema>): Promise<string> {
  try {
    const date = args.date || new Date().toISOString().slice(0, 10)
    const lever = createDailyLever(args.title, date, { projectId: args.projectId })
    return JSON.stringify({ success: true, data: lever })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

export const toggleLeverSchema = z.object({
  leverId: z.string().describe('Lever ID to toggle complete/incomplete'),
})

export async function toggleLeverHandler(args: z.infer<typeof toggleLeverSchema>): Promise<string> {
  try {
    const lever = toggleDailyLever(args.leverId)
    return JSON.stringify({ success: true, data: lever })
  } catch (e: any) {
    return JSON.stringify({ success: false, error: e.message })
  }
}

// ---------- Journal ----------

export const getJournalSchema = z.object({
  date: z.string().optional().describe('Date (YYYY-MM-DD), defaults to today'),
  type: z.enum(['morning', 'evening', 'breaker', 'walking', 'freeform']).optional().describe('Journal type'),
})

export async function getJournalHandler(args: z.infer<typeof getJournalSchema>): Promise<string> {
  const date = args.date || new Date().toISOString().slice(0, 10)
  if (args.type) {
    const entry = getJournalEntry(date, args.type)
    return JSON.stringify({ success: true, data: entry || null })
  }
  const entries = getJournalEntries({ from: date, to: date })
  return JSON.stringify({ success: true, data: entries })
}

// ---------- Stats ----------

export const getStatsSchema = z.object({})

export async function getStatsHandler(): Promise<string> {
  return JSON.stringify({ success: true, data: getLifeOsStats() })
}
