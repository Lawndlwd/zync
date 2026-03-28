import { z } from 'zod'
import { getTasksClient } from './google-auth.js'

// --- gtasks_list_tasklists ---

export const gtasksListTasklistsSchema = z.object({
  max_results: z.number().default(20).describe('Maximum number of task lists (default 20)'),
})

export async function gtasksListTasklists(input: z.infer<typeof gtasksListTasklistsSchema>): Promise<string> {
  const tasks = getTasksClient()

  const res = await tasks.tasklists.list({
    maxResults: input.max_results,
  })

  const lists = (res.data.items || []).map((l) => ({
    id: l.id,
    title: l.title,
    updated: l.updated,
  }))

  return JSON.stringify({ count: lists.length, tasklists: lists })
}

// --- gtasks_list_tasks ---

export const gtasksListTasksSchema = z.object({
  tasklist_id: z.string().default('@default').describe('Task list ID (default "@default" for primary list)'),
  show_completed: z.boolean().default(false).describe('Include completed tasks (default false)'),
  max_results: z.number().default(50).describe('Maximum number of tasks (default 50)'),
})

export async function gtasksListTasks(input: z.infer<typeof gtasksListTasksSchema>): Promise<string> {
  const tasks = getTasksClient()

  const res = await tasks.tasks.list({
    tasklist: input.tasklist_id,
    maxResults: input.max_results,
    showCompleted: input.show_completed,
    showHidden: input.show_completed,
  })

  const items = (res.data.items || []).map((t) => ({
    id: t.id,
    title: t.title,
    notes: t.notes || '',
    status: t.status,
    due: t.due || '',
    updated: t.updated,
    parent: t.parent || '',
    position: t.position,
  }))

  return JSON.stringify({ count: items.length, tasks: items })
}

// --- gtasks_create_task ---

export const gtasksCreateTaskSchema = z.object({
  title: z.string().describe('Task title'),
  notes: z.string().optional().describe('Task notes/description'),
  due: z.string().optional().describe('Due date in ISO 8601 format (e.g. 2025-01-15T00:00:00.000Z)'),
  tasklist_id: z.string().default('@default').describe('Task list ID (default "@default")'),
})

export async function gtasksCreateTask(input: z.infer<typeof gtasksCreateTaskSchema>): Promise<string> {
  const tasks = getTasksClient()

  const body: any = { title: input.title }
  if (input.notes) body.notes = input.notes
  if (input.due) body.due = input.due

  const res = await tasks.tasks.insert({
    tasklist: input.tasklist_id,
    requestBody: body,
  })

  return JSON.stringify({
    success: true,
    id: res.data.id,
    title: res.data.title,
    status: res.data.status,
  })
}

// --- gtasks_complete_task ---

export const gtasksCompleteTaskSchema = z.object({
  task_id: z.string().describe('Task ID to mark as completed'),
  tasklist_id: z.string().default('@default').describe('Task list ID (default "@default")'),
})

export async function gtasksCompleteTask(input: z.infer<typeof gtasksCompleteTaskSchema>): Promise<string> {
  const tasks = getTasksClient()

  const res = await tasks.tasks.patch({
    tasklist: input.tasklist_id,
    task: input.task_id,
    requestBody: { status: 'completed' },
  })

  return JSON.stringify({
    success: true,
    id: res.data.id,
    title: res.data.title,
    status: res.data.status,
  })
}
