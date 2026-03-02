import type { Project, Task, TaskStatus } from '@/types/project'

const API = '/api/projects'

// ── Projects ──

export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(API)
  if (!res.ok) throw new Error('Failed to fetch projects')
  return res.json()
}

export async function fetchProject(name: string): Promise<Project> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error('Failed to fetch project')
  return res.json()
}

export async function createProject(input: {
  name: string
  title?: string
  description?: string
  tags?: string[]
  color?: string
  icon?: string
  content?: string
}): Promise<Project> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create project')
  return res.json()
}

export async function updateProject(
  name: string,
  updates: Partial<{ title: string; description: string; tags: string[]; color: string; icon: string; content: string }>
): Promise<Project> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update project')
  return res.json()
}

export async function deleteProject(name: string): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete project')
}

// ── Tasks ──

export async function fetchAllTasks(): Promise<Task[]> {
  const res = await fetch(`${API}/all-tasks`)
  if (!res.ok) throw new Error('Failed to fetch all tasks')
  return res.json()
}

export async function fetchProjectTasks(projectName: string): Promise<Task[]> {
  const res = await fetch(`${API}/${encodeURIComponent(projectName)}/tasks`)
  if (!res.ok) throw new Error('Failed to fetch project tasks')
  return res.json()
}

export async function createTask(
  projectName: string,
  input: {
    title: string
    assignee?: string
    priority?: string
    tags?: string[]
    content?: string
  }
): Promise<Task> {
  const res = await fetch(`${API}/${encodeURIComponent(projectName)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create task')
  return res.json()
}

export async function updateTask(
  projectName: string,
  taskFile: string,
  updates: Partial<{ title: string; status: string; assignee: string; priority: string; tags: string[]; content: string }>
): Promise<Task> {
  // Server expects { metadata: {...}, content } — separate metadata fields from content
  const { content, ...metadataFields } = updates
  const body: Record<string, unknown> = {}
  if (Object.keys(metadataFields).length > 0) body.metadata = metadataFields
  if (content !== undefined) body.content = content

  const res = await fetch(`${API}/${encodeURIComponent(projectName)}/tasks/${encodeURIComponent(taskFile)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to update task')
  return res.json()
}

export async function updateTaskStatus(
  projectName: string,
  taskFile: string,
  status: TaskStatus
): Promise<Task> {
  const res = await fetch(`${API}/${encodeURIComponent(projectName)}/tasks/${encodeURIComponent(taskFile)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) throw new Error('Failed to update task status')
  return res.json()
}

export async function deleteTask(projectName: string, taskFile: string): Promise<void> {
  const res = await fetch(`${API}/${encodeURIComponent(projectName)}/tasks/${encodeURIComponent(taskFile)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete task')
}
