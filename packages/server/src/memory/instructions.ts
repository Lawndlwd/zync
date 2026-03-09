import { getBrainDb } from './brain-db.js'

export interface Instruction {
  id: number
  content: string
  source: 'explicit' | 'extracted'
  active: number
  created_at: string
  updated_at: string
}

export function getAllInstructions(): Instruction[] {
  const db = getBrainDb()
  return db.prepare('SELECT * FROM instructions ORDER BY created_at DESC').all() as Instruction[]
}

export function getActiveInstructions(): Instruction[] {
  const db = getBrainDb()
  return db
    .prepare('SELECT * FROM instructions WHERE active = 1 ORDER BY created_at DESC')
    .all() as Instruction[]
}

export function addInstruction(
  content: string,
  source: 'explicit' | 'extracted' = 'explicit',
): { id: number } {
  const db = getBrainDb()
  const result = db.prepare('INSERT INTO instructions (content, source) VALUES (?, ?)').run(content, source)
  return { id: result.lastInsertRowid as number }
}

export function updateInstruction(
  id: number,
  updates: { content?: string; active?: boolean },
): boolean {
  const db = getBrainDb()
  const setClauses: string[] = []
  const params: (string | number)[] = []

  if (updates.content !== undefined) {
    setClauses.push('content = ?')
    params.push(updates.content)
  }

  if (updates.active !== undefined) {
    setClauses.push('active = ?')
    params.push(updates.active ? 1 : 0)
  }

  if (setClauses.length === 0) return false

  setClauses.push("updated_at = datetime('now')")
  params.push(id)

  const result = db
    .prepare(`UPDATE instructions SET ${setClauses.join(', ')} WHERE id = ?`)
    .run(...params)

  return result.changes > 0
}

export function deleteInstruction(id: number): boolean {
  const db = getBrainDb()
  const result = db.prepare('DELETE FROM instructions WHERE id = ?').run(id)
  return result.changes > 0
}

export function buildInstructionsBlock(): string {
  const active = getActiveInstructions()
  if (active.length === 0) return ''

  const lines = active.map((i) => `- ${i.content}`)
  return `## Instructions\n${lines.join('\n')}`
}
