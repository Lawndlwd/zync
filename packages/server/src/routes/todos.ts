import { Router } from 'express'
import { getDb } from '../bot/memory/db.js'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { TodoCreateSchema, TodoUpdateSchema } from '@zync/shared/schemas'

export const todosRouter = Router()

todosRouter.get('/', (_req, res) => {
  try {
    const db = getDb()
    const todos = db
      .prepare('SELECT * FROM todos ORDER BY "order" ASC, created_at DESC')
      .all()
    res.json(todos)
  } catch (err) {
    errorResponse(res, err)
  }
})

todosRouter.post('/', validate(TodoCreateSchema), (req, res) => {
  try {
    const db = getDb()
    const { title, description, linkedIssue, priority, dueDate } = req.body
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    db.prepare(
      `INSERT INTO todos (id, title, description, linked_issue, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, title, description || '', linkedIssue || null, priority || 'P3', dueDate || null)
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id)
    res.json(todo)
  } catch (err) {
    errorResponse(res, err)
  }
})

todosRouter.put('/:id', validate(TodoUpdateSchema), (req, res) => {
  try {
    const db = getDb()
    const { title, description, linkedIssue, priority, dueDate, status, order } = req.body
    const sets: string[] = []
    const values: unknown[] = []

    if (title !== undefined) { sets.push('title = ?'); values.push(title) }
    if (description !== undefined) { sets.push('description = ?'); values.push(description) }
    if (linkedIssue !== undefined) { sets.push('linked_issue = ?'); values.push(linkedIssue) }
    if (priority !== undefined) { sets.push('priority = ?'); values.push(priority) }
    if (dueDate !== undefined) { sets.push('due_date = ?'); values.push(dueDate) }
    if (status !== undefined) { sets.push('status = ?'); values.push(status) }
    if (order !== undefined) { sets.push('"order" = ?'); values.push(order) }

    if (sets.length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    sets.push("updated_at = datetime('now')")
    values.push(req.params.id)

    db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...values)
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id)
    res.json(todo)
  } catch (err) {
    errorResponse(res, err)
  }
})

todosRouter.delete('/:id', (req, res) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})
