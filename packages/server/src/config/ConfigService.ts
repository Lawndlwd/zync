import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'

const DEFAULT_DB_PATH = resolve(import.meta.dirname, '../../data/secrets.db')

export interface SettingMeta {
  key: string
  value: string
  category: string
  updatedAt: string
}

export class ConfigService {
  private db: Database.Database

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);
    `)
  }

  get(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined

    if (!row) return null
    return row.value
  }

  set(key: string, value: string, category: string = 'general'): void {
    this.db
      .prepare(`
      INSERT INTO settings (key, value, category)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category,
        updated_at = datetime('now')
    `)
      .run(key, value, category)
  }

  delete(key: string): boolean {
    const result = this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    return result.changes > 0
  }

  list(category?: string): SettingMeta[] {
    const query = category
      ? 'SELECT key, value, category, updated_at FROM settings WHERE category = ? ORDER BY key'
      : 'SELECT key, value, category, updated_at FROM settings ORDER BY key'
    const rows = category ? this.db.prepare(query).all(category) : this.db.prepare(query).all()
    return (rows as Array<{ key: string; value: string; category: string; updated_at: string }>).map((r) => ({
      key: r.key,
      value: r.value,
      category: r.category,
      updatedAt: r.updated_at,
    }))
  }

  bulkSet(items: Array<{ key: string; value: string; category?: string }>): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, category)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        category = excluded.category,
        updated_at = datetime('now')
    `)
    const transaction = this.db.transaction((entries: typeof items) => {
      for (const item of entries) {
        stmt.run(item.key, item.value, item.category ?? 'general')
      }
    })
    transaction(items)
  }

  close(): void {
    this.db.close()
  }
}
