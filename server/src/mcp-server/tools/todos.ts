import { z } from 'zod'
import { getDb } from '../../bot/memory/db.js'

export function initTodosTable(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      linked_issue TEXT,
      priority TEXT DEFAULT 'P3',
      due_date TEXT,
      status TEXT DEFAULT 'open',
      "order" INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export const createTodoSchema = z.object({
  title: z.string().describe('To-do title'),
  description: z.string().default('').describe('To-do description'),
  linked_issue: z.string().optional().describe('Optional Jira issue key'),
})

export async function createTodo(input: z.infer<typeof createTodoSchema>) {
  const db = getDb()
  const id = generateId()
  db.prepare(
    `INSERT INTO todos (id, title, description, linked_issue) VALUES (?, ?, ?, ?)`
  ).run(id, input.title, input.description, input.linked_issue || null)
  return JSON.stringify({ id, title: input.title })
}

export const markTodoDoneSchema = z.object({
  id: z.string().describe('To-do ID'),
})

export async function markTodoDone(input: z.infer<typeof markTodoDoneSchema>) {
  const db = getDb()
  const result = db
    .prepare(`UPDATE todos SET status = 'done', updated_at = datetime('now') WHERE id = ?`)
    .run(input.id)
  return JSON.stringify({ success: result.changes > 0 })
}

// --- New tools ---

export const listTodosSchema = z.object({
  status: z.string().optional().describe('Filter by status (open, done). Omit for all.'),
})

export async function listTodos(input: z.infer<typeof listTodosSchema>) {
  const db = getDb()
  const rows = input.status
    ? db.prepare('SELECT * FROM todos WHERE status = ? ORDER BY "order" ASC, created_at DESC').all(input.status)
    : db.prepare('SELECT * FROM todos ORDER BY "order" ASC, created_at DESC').all()
  return JSON.stringify(rows)
}

export const updateTodoSchema = z.object({
  id: z.string().describe('To-do ID'),
  title: z.string().optional().describe('New title'),
  description: z.string().optional().describe('New description'),
  priority: z.string().optional().describe('New priority (P1-P4)'),
  due_date: z.string().optional().describe('New due date (YYYY-MM-DD)'),
  status: z.string().optional().describe('New status (open, done)'),
})

export async function updateTodo(input: z.infer<typeof updateTodoSchema>) {
  const db = getDb()
  const sets: string[] = []
  const values: any[] = []
  if (input.title !== undefined) { sets.push('title = ?'); values.push(input.title) }
  if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description) }
  if (input.priority !== undefined) { sets.push('priority = ?'); values.push(input.priority) }
  if (input.due_date !== undefined) { sets.push('due_date = ?'); values.push(input.due_date) }
  if (input.status !== undefined) { sets.push('status = ?'); values.push(input.status) }
  if (sets.length === 0) return JSON.stringify({ success: false, error: 'No fields to update' })
  sets.push("updated_at = datetime('now')")
  values.push(input.id)
  const result = db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return JSON.stringify({ success: result.changes > 0 })
}

export const deleteTodoSchema = z.object({
  id: z.string().describe('To-do ID'),
})

export async function deleteTodo(input: z.infer<typeof deleteTodoSchema>) {
  const db = getDb()
  const result = db.prepare('DELETE FROM todos WHERE id = ?').run(input.id)
  return JSON.stringify({ success: result.changes > 0 })
}
