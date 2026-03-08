import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { logger } from '../lib/logger.js'
import type { WidgetConfig, WidgetType } from './types.js'

const DB_PATH = resolve(import.meta.dirname, '../../data/widgets.db')

let db: Database.Database | null = null

export function getWidgetsDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initWidgetsDb(): void {
  const db = getWidgetsDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS widgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      settings TEXT NOT NULL DEFAULT '{}',
      cached_data TEXT,
      last_refreshed TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  logger.info('Widgets DB initialized')
}

function parseWidget(row: any): WidgetConfig {
  return {
    ...row,
    settings: JSON.parse(row.settings || '{}'),
    cached_data: row.cached_data ? JSON.parse(row.cached_data) : null,
  }
}

export function getWidgets(): WidgetConfig[] {
  const db = getWidgetsDb()
  const rows = db.prepare('SELECT * FROM widgets ORDER BY created_at DESC').all()
  return rows.map(parseWidget)
}

export function getWidget(id: number): WidgetConfig | undefined {
  const db = getWidgetsDb()
  const row = db.prepare('SELECT * FROM widgets WHERE id = ?').get(id)
  return row ? parseWidget(row) : undefined
}

export function createWidget(type: WidgetType, settings: Record<string, any>): WidgetConfig {
  const db = getWidgetsDb()
  const result = db.prepare('INSERT INTO widgets (type, settings) VALUES (?, ?)').run(
    type,
    JSON.stringify(settings)
  )
  return getWidget(result.lastInsertRowid as number)!
}

export function updateWidgetCache(id: number, data: any): void {
  const db = getWidgetsDb()
  db.prepare('UPDATE widgets SET cached_data = ?, last_refreshed = datetime(\'now\') WHERE id = ?').run(
    JSON.stringify(data),
    id
  )
}

export function updateWidgetSettings(id: number, settings: Record<string, any>): WidgetConfig | undefined {
  const db = getWidgetsDb()
  db.prepare('UPDATE widgets SET settings = ? WHERE id = ?').run(
    JSON.stringify(settings),
    id
  )
  return getWidget(id)
}

export function deleteWidget(id: number): void {
  const db = getWidgetsDb()
  db.prepare('DELETE FROM widgets WHERE id = ?').run(id)
}
