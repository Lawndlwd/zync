import { getSocialDb } from '../social/db.js'
import { logger } from '../lib/logger.js'

export function initTelegramDb(): void {
  const db = getSocialDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_dms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT NOT NULL,
      username TEXT,
      display_name TEXT,
      message_text TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'uncategorized',
      auto_replied INTEGER NOT NULL DEFAULT 0,
      reply_text TEXT,
      business_connection_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_telegram_dms_user ON telegram_dms(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_telegram_dms_category ON telegram_dms(category);
  `)

  logger.info('Telegram DMs table initialized')
}

export function insertDM(dm: {
  telegramUserId: string
  username?: string
  displayName?: string
  messageText: string
  category?: string
  autoReplied?: boolean
  replyText?: string
  businessConnectionId?: string
}): number {
  const db = getSocialDb()
  const stmt = db.prepare(`
    INSERT INTO telegram_dms (telegram_user_id, username, display_name, message_text, category, auto_replied, reply_text, business_connection_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    dm.telegramUserId,
    dm.username ?? null,
    dm.displayName ?? null,
    dm.messageText,
    dm.category ?? 'uncategorized',
    dm.autoReplied ? 1 : 0,
    dm.replyText ?? null,
    dm.businessConnectionId ?? null,
  )
  return result.lastInsertRowid as number
}

export function updateDMCategory(id: number, category: string): void {
  const db = getSocialDb()
  db.prepare('UPDATE telegram_dms SET category = ? WHERE id = ?').run(category, id)
}

export function updateDMReply(id: number, replyText: string): void {
  const db = getSocialDb()
  db.prepare('UPDATE telegram_dms SET auto_replied = 1, reply_text = ? WHERE id = ?').run(replyText, id)
}

export function getDMs(opts?: { category?: string; limit?: number; offset?: number }): unknown[] {
  const db = getSocialDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (opts?.category) {
    conditions.push('category = ?')
    params.push(opts.category)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0

  return db.prepare(`SELECT * FROM telegram_dms ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)
}

export function getDMStats(): { total: number; byCategory: Record<string, number> } {
  const db = getSocialDb()
  const total = (db.prepare('SELECT COUNT(*) as count FROM telegram_dms').get() as { count: number }).count
  const rows = db.prepare('SELECT category, COUNT(*) as count FROM telegram_dms GROUP BY category').all() as Array<{ category: string; count: number }>
  const byCategory: Record<string, number> = {}
  for (const row of rows) byCategory[row.category] = row.count
  return { total, byCategory }
}
