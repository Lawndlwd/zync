// server/src/memory/search.ts

import { getDb } from '../bot/memory/db.js'
import { generateEmbedding, embeddingToBuffer, bufferToEmbedding, cosineSimilarity, getModelName } from './embeddings.js'
import { logger } from '../lib/logger.js'

export interface MemorySearchResult {
  id: number
  content: string
  category: string
  created_at: string
  score: number
  source: 'vector' | 'keyword' | 'hybrid'
}

const VECTOR_WEIGHT = 0.7
const KEYWORD_WEIGHT = 0.3

export async function hybridSearch(query: string, limit = 10): Promise<MemorySearchResult[]> {
  const db = getDb()

  // BM25 keyword search via FTS5
  let keywordResults: Array<{ id: number; content: string; category: string; created_at: string; rank: number }> = []
  try {
    keywordResults = db.prepare(`
      SELECT m.id, m.content, m.category, m.created_at, rank
      FROM memories_fts f
      JOIN memories m ON m.id = f.rowid
      WHERE memories_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit * 2) as typeof keywordResults
  } catch {
    // FTS match can fail on special characters
  }

  // Vector search — brute force over all memories with embeddings
  let vectorResults: Array<{ id: number; content: string; category: string; created_at: string; score: number }> = []
  try {
    const queryEmbedding = await generateEmbedding(query)
    const rows = db.prepare(`
      SELECT id, content, category, created_at, embedding, relevance_score
      FROM memories WHERE embedding IS NOT NULL
    `).all() as Array<{ id: number; content: string; category: string; created_at: string; embedding: Buffer; relevance_score: number }>

    const scored = rows.map((row) => {
      const rowEmbedding = bufferToEmbedding(row.embedding)
      const sim = cosineSimilarity(queryEmbedding, rowEmbedding)
      return { id: row.id, content: row.content, category: row.category, created_at: row.created_at, score: sim * (row.relevance_score ?? 1) }
    })
    scored.sort((a, b) => b.score - a.score)
    vectorResults = scored.slice(0, limit * 2)
  } catch (err) {
    logger.error({ err }, 'Vector search error')
  }

  // Combine results with hybrid scoring
  const combined = new Map<number, MemorySearchResult>()

  const maxRank = keywordResults.length > 0 ? Math.max(...keywordResults.map(r => Math.abs(r.rank))) : 1
  for (const r of keywordResults) {
    const normalizedScore = 1 - (Math.abs(r.rank) / (maxRank + 1))
    combined.set(r.id, {
      id: r.id, content: r.content, category: r.category, created_at: r.created_at,
      score: normalizedScore * KEYWORD_WEIGHT,
      source: 'keyword',
    })
  }

  for (const r of vectorResults) {
    const existing = combined.get(r.id)
    if (existing) {
      existing.score += r.score * VECTOR_WEIGHT
      existing.source = 'hybrid'
    } else {
      combined.set(r.id, {
        id: r.id, content: r.content, category: r.category, created_at: r.created_at,
        score: r.score * VECTOR_WEIGHT,
        source: 'vector',
      })
    }
  }

  const results = Array.from(combined.values())
  results.sort((a, b) => b.score - a.score)

  // Track access for retrieved memories
  const ids = results.slice(0, limit).map(r => r.id)
  if (ids.length > 0) {
    db.prepare(`
      UPDATE memories SET access_count = access_count + 1, last_accessed = datetime('now')
      WHERE id IN (${ids.map(() => '?').join(',')})
    `).run(...ids)
  }

  return results.slice(0, limit)
}

export async function saveMemoryWithEmbedding(content: string, category = 'general'): Promise<{ id: number }> {
  const db = getDb()
  const embedding = await generateEmbedding(content)
  const embeddingBuf = embeddingToBuffer(embedding)

  const result = db.prepare(`
    INSERT INTO memories (content, category, embedding, embedding_model)
    VALUES (?, ?, ?, ?)
  `).run(content, category, embeddingBuf, getModelName())

  return { id: Number(result.lastInsertRowid) }
}

export async function reembedAllMemories(): Promise<number> {
  const db = getDb()
  const rows = db.prepare('SELECT id, content FROM memories').all() as Array<{ id: number; content: string }>

  let count = 0
  for (const row of rows) {
    try {
      const embedding = await generateEmbedding(row.content)
      const buf = embeddingToBuffer(embedding)
      db.prepare('UPDATE memories SET embedding = ?, embedding_model = ? WHERE id = ?')
        .run(buf, getModelName(), row.id)
      count++
    } catch (err) {
      logger.error({ err, memoryId: row.id }, 'Failed to embed memory')
    }
  }
  return count
}
