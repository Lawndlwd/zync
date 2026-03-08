import { getDb } from '../memory/db.js'
import { logger } from '../../lib/logger.js'

export interface Schedule {
  id: number
  chat_id: number
  cron_expression: string
  prompt: string
  enabled: number
  created_at: string
}

export function initSchedulesTable(): void {
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      cron_expression TEXT NOT NULL,
      prompt TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  logger.info('Schedules table initialized')
}

export function addSchedule(chatId: number, cronExpression: string, prompt: string): Schedule {
  const db = getDb()
  const stmt = db.prepare(
    'INSERT INTO schedules (chat_id, cron_expression, prompt) VALUES (?, ?, ?)',
  )
  const result = stmt.run(chatId, cronExpression, prompt)
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(result.lastInsertRowid) as Schedule
}

export function removeSchedule(id: number, chatId: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM schedules WHERE id = ? AND chat_id = ?').run(id, chatId)
  return result.changes > 0
}

export function listSchedules(chatId: number): Schedule[] {
  const db = getDb()
  return db.prepare('SELECT * FROM schedules WHERE chat_id = ? ORDER BY id').all(chatId) as Schedule[]
}

export function getAllEnabledSchedules(): Schedule[] {
  const db = getDb()
  return db.prepare('SELECT * FROM schedules WHERE enabled = 1').all() as Schedule[]
}

export function toggleSchedule(id: number, chatId: number, enabled: boolean): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE schedules SET enabled = ? WHERE id = ? AND chat_id = ?').run(
    enabled ? 1 : 0,
    id,
    chatId,
  )
  return result.changes > 0
}

export function getAllSchedules(): Schedule[] {
  const db = getDb()
  return db.prepare('SELECT * FROM schedules ORDER BY id').all() as Schedule[]
}

export function adminRemoveSchedule(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
  return result.changes > 0
}

export function adminToggleSchedule(id: number, enabled: boolean): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE schedules SET enabled = ? WHERE id = ?').run(
    enabled ? 1 : 0,
    id,
  )
  return result.changes > 0
}
