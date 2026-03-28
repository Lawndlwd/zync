import type { PlannerGoal, PlannerPage, PlannerReminder } from '@zync/shared/types'

const API = '/api/planner'

function rowToGoal(row: any): PlannerGoal {
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    targetDate: row.target_date,
    status: row.status,
    progress: row.progress,
    aiPlan: row.ai_plan ? JSON.parse(row.ai_plan) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToReminder(row: any): PlannerReminder {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    repeat: row.repeat,
    completed: !!row.completed,
    linkedGoalId: row.linked_goal_id,
    linkedTodoId: row.linked_todo_id,
    createdAt: row.created_at,
  }
}

function rowToPage(row: any): PlannerPage {
  return {
    id: row.id,
    categoryId: row.category_id,
    parentId: row.parent_id,
    title: row.title,
    icon: row.icon,
    content: row.content,
    pageType: row.page_type,
    pinned: !!row.pinned,
    isSystem: !!row.is_system,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// --- Goals ---
export async function fetchGoals(categoryId?: string): Promise<PlannerGoal[]> {
  const url = categoryId ? `${API}/goals?category=${categoryId}` : `${API}/goals`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch goals')
  const rows = await res.json()
  return rows.map(rowToGoal)
}

export async function updatePlannerGoal(
  id: string,
  updates: Partial<{
    title: string
    description: string
    targetDate: string
    status: string
    progress: number
    aiPlan: any
  }>,
): Promise<PlannerGoal> {
  const res = await fetch(`${API}/goals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update goal')
  return rowToGoal(await res.json())
}

export async function deletePlannerGoal(id: string): Promise<void> {
  const res = await fetch(`${API}/goals/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete goal')
}

// --- Reminders ---
export async function fetchReminders(upcoming = false): Promise<PlannerReminder[]> {
  const res = await fetch(`${API}/reminders${upcoming ? '?upcoming=true' : ''}`)
  if (!res.ok) throw new Error('Failed to fetch reminders')
  const rows = await res.json()
  return rows.map(rowToReminder)
}

export async function createPlannerReminder(input: {
  title: string
  dueAt: string
  description?: string
  repeat?: string
  linkedGoalId?: string
  linkedTodoId?: string
}): Promise<PlannerReminder> {
  const res = await fetch(`${API}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create reminder')
  return rowToReminder(await res.json())
}

export async function updatePlannerReminder(
  id: string,
  updates: Partial<{ title: string; description: string; dueAt: string; repeat: string; completed: boolean }>,
): Promise<PlannerReminder> {
  const res = await fetch(`${API}/reminders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update reminder')
  return rowToReminder(await res.json())
}

export async function deletePlannerReminder(id: string): Promise<void> {
  const res = await fetch(`${API}/reminders/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete reminder')
}

// --- Pages ---
export async function fetchPage(id: string): Promise<PlannerPage> {
  const res = await fetch(`${API}/pages/${id}`)
  if (!res.ok) throw new Error('Failed to fetch page')
  return rowToPage(await res.json())
}

export async function createPlannerPage(input: {
  categoryId: string
  title: string
  parentId?: string
  icon?: string
  content?: string
  pageType?: string
  pinned?: boolean
  order?: number
}): Promise<PlannerPage> {
  const res = await fetch(`${API}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create page')
  return rowToPage(await res.json())
}

export async function updatePlannerPage(
  id: string,
  updates: Partial<{
    title: string
    content: string
    icon: string
    pinned: boolean
    parentId: string | null
    order: number
  }>,
): Promise<PlannerPage> {
  const res = await fetch(`${API}/pages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update page')
  return rowToPage(await res.json())
}

export async function deletePlannerPage(id: string): Promise<void> {
  const res = await fetch(`${API}/pages/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete page')
}
