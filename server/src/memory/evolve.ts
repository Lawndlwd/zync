// server/src/memory/evolve.ts

import { getDb } from '../bot/memory/db.js'
import { bufferToEmbedding, cosineSimilarity } from './embeddings.js'
import { logger } from '../lib/logger.js'

const DECAY_DAYS = 90
const DECAY_FACTOR = 0.9
const MERGE_THRESHOLD = 0.95
const CLEANUP_THRESHOLD = 0.1

export function decayUnusedMemories(): number {
  const db = getDb()
  const result = db.prepare(`
    UPDATE memories
    SET relevance_score = relevance_score * ?
    WHERE (last_accessed IS NULL AND created_at < datetime('now', ?))
       OR (last_accessed IS NOT NULL AND last_accessed < datetime('now', ?))
  `).run(DECAY_FACTOR, `-${DECAY_DAYS} days`, `-${DECAY_DAYS} days`)
  return result.changes
}

export function cleanupLowRelevance(): number {
  const db = getDb()
  const result = db.prepare(`
    DELETE FROM memories WHERE relevance_score < ?
  `).run(CLEANUP_THRESHOLD)
  return result.changes
}

export async function mergeDuplicates(): Promise<number> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT id, content, category, embedding FROM memories WHERE embedding IS NOT NULL
  `).all() as Array<{ id: number; content: string; category: string; embedding: Buffer }>

  const toDelete: number[] = []
  const processed = new Set<number>()

  for (let i = 0; i < rows.length; i++) {
    if (processed.has(rows[i].id)) continue
    const embA = bufferToEmbedding(rows[i].embedding)

    for (let j = i + 1; j < rows.length; j++) {
      if (processed.has(rows[j].id)) continue
      const embB = bufferToEmbedding(rows[j].embedding)
      const sim = cosineSimilarity(embA, embB)

      if (sim >= MERGE_THRESHOLD) {
        const keepId = rows[i].content.length >= rows[j].content.length ? rows[i].id : rows[j].id
        const deleteId = keepId === rows[i].id ? rows[j].id : rows[i].id
        toDelete.push(deleteId)
        processed.add(deleteId)
      }
    }
  }

  for (const id of toDelete) {
    db.prepare('DELETE FROM memories WHERE id = ?').run(id)
  }

  return toDelete.length
}

export async function runEvolution(): Promise<{ decayed: number; merged: number; cleaned: number }> {
  logger.info('Memory evolution: starting...')
  const decayed = decayUnusedMemories()
  const merged = await mergeDuplicates()
  const cleaned = cleanupLowRelevance()
  logger.info({ decayed, merged, cleaned }, 'Memory evolution complete')
  return { decayed, merged, cleaned }
}
