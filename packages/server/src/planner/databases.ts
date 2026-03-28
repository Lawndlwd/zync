import { getPlannerDb } from './db.js'

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// --- Init tables ---
export function initDatabaseTables(): void {
  const db = getPlannerDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS planner_databases (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📊',
      schema TEXT DEFAULT '[]',
      category_id TEXT NOT NULL REFERENCES planner_categories(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_db_items (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES planner_databases(id) ON DELETE CASCADE,
      data TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS planner_db_views (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES planner_databases(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      view_type TEXT DEFAULT 'table',
      config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

// --- Databases ---
export function getDatabases(categoryId?: string) {
  const db = getPlannerDb()
  if (categoryId) {
    return db.prepare('SELECT * FROM planner_databases WHERE category_id = ? ORDER BY created_at DESC').all(categoryId)
  }
  return db.prepare('SELECT * FROM planner_databases ORDER BY created_at DESC').all()
}

export function getDatabase(id: string) {
  return getPlannerDb().prepare('SELECT * FROM planner_databases WHERE id = ?').get(id)
}

export function createDatabase(name: string, categoryId: string, opts: { icon?: string; schema?: string } = {}) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO planner_databases (id, name, icon, schema, category_id) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name,
    opts.icon || '📊',
    opts.schema || '[]',
    categoryId,
  )
  return db.prepare('SELECT * FROM planner_databases WHERE id = ?').get(id)
}

export function deleteDatabase(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_databases WHERE id = ?').run(id)
}

// --- Items ---
export function getDbItems(databaseId: string) {
  return getPlannerDb()
    .prepare('SELECT * FROM planner_db_items WHERE database_id = ? ORDER BY created_at DESC')
    .all(databaseId)
}

export function getDbItem(id: string) {
  return getPlannerDb().prepare('SELECT * FROM planner_db_items WHERE id = ?').get(id)
}

export function createDbItem(databaseId: string, data: Record<string, unknown>) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO planner_db_items (id, database_id, data) VALUES (?, ?, ?)').run(
    id,
    databaseId,
    JSON.stringify(data),
  )
  return db.prepare('SELECT * FROM planner_db_items WHERE id = ?').get(id)
}

export function updateDbItem(id: string, data: Record<string, unknown>) {
  const db = getPlannerDb()
  db.prepare("UPDATE planner_db_items SET data = ?, updated_at = datetime('now') WHERE id = ?").run(
    JSON.stringify(data),
    id,
  )
  return db.prepare('SELECT * FROM planner_db_items WHERE id = ?').get(id)
}

export function deleteDbItem(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_db_items WHERE id = ?').run(id)
}

// --- Views ---
export function getDbViews(databaseId: string) {
  return getPlannerDb()
    .prepare('SELECT * FROM planner_db_views WHERE database_id = ? ORDER BY created_at ASC')
    .all(databaseId)
}

export function getDbView(id: string) {
  return getPlannerDb().prepare('SELECT * FROM planner_db_views WHERE id = ?').get(id)
}

export function createDbView(databaseId: string, name: string, viewType: string, config: Record<string, unknown> = {}) {
  const db = getPlannerDb()
  const id = genId()
  db.prepare('INSERT INTO planner_db_views (id, database_id, name, view_type, config) VALUES (?, ?, ?, ?, ?)').run(
    id,
    databaseId,
    name,
    viewType,
    JSON.stringify(config),
  )
  return db.prepare('SELECT * FROM planner_db_views WHERE id = ?').get(id)
}

export function updateDbView(
  id: string,
  updates: { name?: string; viewType?: string; config?: Record<string, unknown> },
) {
  const db = getPlannerDb()
  const sets: string[] = []
  const values: unknown[] = []
  if (updates.name !== undefined) {
    sets.push('name = ?')
    values.push(updates.name)
  }
  if (updates.viewType !== undefined) {
    sets.push('view_type = ?')
    values.push(updates.viewType)
  }
  if (updates.config !== undefined) {
    sets.push('config = ?')
    values.push(JSON.stringify(updates.config))
  }
  if (sets.length === 0) return null
  values.push(id)
  db.prepare(`UPDATE planner_db_views SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM planner_db_views WHERE id = ?').get(id)
}

export function deleteDbView(id: string) {
  getPlannerDb().prepare('DELETE FROM planner_db_views WHERE id = ?').run(id)
}
