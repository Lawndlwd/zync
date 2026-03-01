import { getDb } from './db.js'

interface MemoryRow {
  id: number
  content: string
  category: string
  created_at: string
  rank: number
}

export function saveMemory(
  content: string,
  category = 'general',
): { id: number } {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO memories (content, category) VALUES (?, ?)')
    .run(content, category)
  return { id: Number(result.lastInsertRowid) }
}

export function searchMemory(query: string, limit = 5): MemoryRow[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT m.id, m.content, m.category, m.created_at, rank
       FROM memories_fts f
       JOIN memories m ON m.id = f.rowid
       WHERE memories_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(query, limit) as MemoryRow[]
}

export function deleteMemory(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id)
  return result.changes > 0
}

export function listCategories(): string[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT DISTINCT category FROM memories ORDER BY category')
    .all() as { category: string }[]
  return rows.map(r => r.category)
}

export function listAllMemories(limit = 50): Omit<MemoryRow, 'rank'>[] {
  const db = getDb()
  return db
    .prepare('SELECT id, content, category, created_at FROM memories ORDER BY id DESC LIMIT ?')
    .all(limit) as Omit<MemoryRow, 'rank'>[]
}

export function getMemoryCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number }
  return row.count
}
