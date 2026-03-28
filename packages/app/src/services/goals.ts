import type { GoalBreadcrumb, LifeOsGoal, LifeOsGoalTask } from '@zync/shared/types'

const API = '/api/planner/life-os'

export async function fetchGoalRoots(status?: string): Promise<LifeOsGoal[]> {
  const url = status ? `${API}/goals?status=${status}` : `${API}/goals`
  const res = await fetch(url)
  return res.json()
}

export async function fetchGoal(id: string): Promise<{ goal: LifeOsGoal; ancestors: GoalBreadcrumb[] }> {
  const res = await fetch(`${API}/goals/${id}`)
  return res.json()
}

export async function fetchGoalChildren(parentId: string): Promise<LifeOsGoal[]> {
  const res = await fetch(`${API}/goals/${parentId}/children`)
  return res.json()
}

export async function createGoal(body: {
  granularity: string
  title: string
  startDate: string
  endDate: string
  parentId?: string
}): Promise<LifeOsGoal> {
  const res = await fetch(`${API}/goals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function updateGoal(id: string, body: Record<string, unknown>): Promise<LifeOsGoal> {
  const res = await fetch(`${API}/goals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function deleteGoal(id: string): Promise<void> {
  await fetch(`${API}/goals/${id}`, { method: 'DELETE' })
}

export async function scaffoldGoalChildren(goalId: string): Promise<LifeOsGoal[]> {
  const res = await fetch(`${API}/goals/${goalId}/scaffold`, { method: 'POST' })
  return res.json()
}

export async function fetchGoalTasks(goalId: string): Promise<LifeOsGoalTask[]> {
  const res = await fetch(`${API}/goals/${goalId}/tasks`)
  return res.json()
}

export async function createGoalTask(goalId: string, title: string): Promise<LifeOsGoalTask> {
  const res = await fetch(`${API}/goals/${goalId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return res.json()
}

export async function toggleGoalTask(id: string): Promise<LifeOsGoalTask> {
  const res = await fetch(`${API}/goal-tasks/${id}/toggle`, { method: 'PUT' })
  return res.json()
}

export async function deleteGoalTask(id: string): Promise<void> {
  await fetch(`${API}/goal-tasks/${id}`, { method: 'DELETE' })
}
