// server/src/memory/memories.ts

import { getBrainDb } from './brain-db.js'
import {
  generateEmbedding,
  cosineSimilarity,
  embeddingToBuffer,
  bufferToEmbedding,
  getModelName,
} from './embeddings.js'
import { logger } from '../lib/logger.js'

export interface MemoryRow {
  id: number
  content: string
  category: string
  source: string
  access_count: number
  last_accessed: string | null
  created_at: string
  updated_at: string
}

const SIMILARITY_THRESHOLD = 0.85

/**
 * Save a memory with deduplication. If a similar memory exists (cosine > 0.85),
 * call mergeFn to merge. If no mergeFn provided or no similar match, save as new.
 */
export async function saveMemoryWithDedup(
  content: string,
  category = 'general',
  source: 'explicit' | 'extracted' | 'tool' = 'tool',
  mergeFn?: (existing: string, incoming: string) => Promise<string>,
): Promise<{ id: number; merged: boolean }> {
  const db = getBrainDb()
  const embedding = await generateEmbedding(content)
  const embeddingBuf = embeddingToBuffer(embedding)

  // Scan all memories with embeddings for similarity
  const rows = db.prepare(`
    SELECT id, content, embedding FROM memories WHERE embedding IS NOT NULL
  `).all() as Array<{ id: number; content: string; embedding: Buffer }>

  let bestMatch: { id: number; content: string; similarity: number } | null = null

  for (const row of rows) {
    const rowEmbedding = bufferToEmbedding(row.embedding)
    const sim = cosineSimilarity(embedding, rowEmbedding)
    if (sim > SIMILARITY_THRESHOLD && (!bestMatch || sim > bestMatch.similarity)) {
      bestMatch = { id: row.id, content: row.content, similarity: sim }
    }
  }

  if (bestMatch && mergeFn) {
    const mergedContent = await mergeFn(bestMatch.content, content)
    const mergedEmbedding = await generateEmbedding(mergedContent)
    const mergedBuf = embeddingToBuffer(mergedEmbedding)

    db.prepare(`
      UPDATE memories
      SET content = ?, category = ?, source = ?, embedding = ?, embedding_model = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(mergedContent, category, source, mergedBuf, getModelName(), bestMatch.id)

    logger.info({ id: bestMatch.id, similarity: bestMatch.similarity }, 'Merged duplicate memory')
    return { id: bestMatch.id, merged: true }
  }

  // Insert new memory
  const result = db.prepare(`
    INSERT INTO memories (content, category, source, embedding, embedding_model)
    VALUES (?, ?, ?, ?, ?)
  `).run(content, category, source, embeddingBuf, getModelName())

  const id = Number(result.lastInsertRowid)
  logger.info({ id, category, source }, 'Saved new memory')
  return { id, merged: false }
}

/**
 * Simple save without dedup (for migration).
 */
export function saveMemoryDirect(
  content: string,
  category = 'general',
  source = 'tool',
): { id: number } {
  const db = getBrainDb()
  const result = db.prepare(`
    INSERT INTO memories (content, category, source)
    VALUES (?, ?, ?)
  `).run(content, category, source)

  return { id: Number(result.lastInsertRowid) }
}

export function deleteMemoryById(id: number): boolean {
  const db = getBrainDb()
  const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id)
  return result.changes > 0
}

export function listMemories(opts?: {
  category?: string
  limit?: number
  offset?: number
}): MemoryRow[] {
  const db = getBrainDb()
  const category = opts?.category
  const limit = opts?.limit ?? 50
  const offset = opts?.offset ?? 0

  if (category) {
    return db.prepare(`
      SELECT id, content, category, source, access_count, last_accessed, created_at, updated_at
      FROM memories
      WHERE category = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(category, limit, offset) as MemoryRow[]
  }

  return db.prepare(`
    SELECT id, content, category, source, access_count, last_accessed, created_at, updated_at
    FROM memories
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as MemoryRow[]
}

export function getMemoryCount(): number {
  const db = getBrainDb()
  const row = db.prepare('SELECT COUNT(*) as cnt FROM memories').get() as { cnt: number }
  return row.cnt
}

export function listMemoryCategories(): string[] {
  const db = getBrainDb()
  const rows = db.prepare('SELECT DISTINCT category FROM memories ORDER BY category').all() as Array<{ category: string }>
  return rows.map(r => r.category)
}
