import type { Todo } from '@/types/todo'

const API = '/api/todos'

interface TodoRow {
  id: string
  title: string
  description: string
  linked_issue: string | null
  priority: string
  due_date: string | null
  status: string
  order: number
  created_at: string
  updated_at: string
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    linkedIssue: row.linked_issue,
    priority: row.priority as Todo['priority'],
    dueDate: row.due_date,
    status: row.status as Todo['status'],
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(API)
  if (!res.ok) throw new Error('Failed to fetch todos')
  const rows: TodoRow[] = await res.json()
  return rows.map(rowToTodo)
}

export async function createTodo(input: {
  title: string
  description?: string
  linkedIssue?: string | null
  priority?: string
  dueDate?: string | null
}): Promise<Todo> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create todo')
  return rowToTodo(await res.json())
}

export async function updateTodo(
  id: string,
  updates: Partial<{
    title: string
    description: string
    linkedIssue: string | null
    priority: string
    dueDate: string | null
    status: string
    order: number
  }>
): Promise<Todo> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update todo')
  return rowToTodo(await res.json())
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete todo')
}
