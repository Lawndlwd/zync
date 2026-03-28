import { existsSync, renameSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { logger } from '../lib/logger.js'
import { getBrainDb } from './brain-db.js'

const DATA_DIR = resolve(import.meta.dirname, '../../data')

export function migrateToBrain(): void {
  const oldPath = resolve(DATA_DIR, 'memory.db')

  if (!existsSync(oldPath)) {
    logger.info('No legacy memory.db found — nothing to migrate')
    return
  }

  const brain = getBrainDb()

  const { cnt } = brain.prepare('SELECT COUNT(*) as cnt FROM memories').get() as { cnt: number }
  if (cnt > 0) {
    logger.info('Brain already has memories — skipping migration')
    return
  }

  const old = new Database(oldPath, { readonly: true })

  let memoriesCount = 0
  let llmCallsCount = 0
  let prAgentCount = 0
  let emailsCount = 0

  // Migrate memories
  try {
    const rows = old
      .prepare(
        'SELECT content, category, embedding, embedding_model, access_count, last_accessed, relevance_score, created_at, updated_at FROM memories',
      )
      .all() as Array<{
      content: string
      category: string
      embedding: Buffer | null
      embedding_model: string | null
      access_count: number
      last_accessed: string | null
      relevance_score: number
      created_at: string
      updated_at: string
    }>

    const insert = brain.prepare(`
      INSERT INTO memories (content, category, source, embedding, embedding_model, access_count, last_accessed, relevance_score, created_at, updated_at)
      VALUES (?, ?, 'tool', ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const row of rows) {
      insert.run(
        row.content,
        row.category,
        row.embedding,
        row.embedding_model,
        row.access_count,
        row.last_accessed,
        row.relevance_score,
        row.created_at,
        row.updated_at,
      )
      memoriesCount++
    }
  } catch (err) {
    logger.error({ err }, 'Failed to migrate memories table')
  }

  // Migrate llm_calls
  try {
    const rows = old
      .prepare(
        'SELECT source, model, prompt_tokens, completion_tokens, total_tokens, tool_names, duration_ms, created_at, session_id, cost, message_id FROM llm_calls',
      )
      .all() as Array<{
      source: string
      model: string
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
      tool_names: string
      duration_ms: number
      created_at: string
      session_id: string | null
      cost: number | null
      message_id: string | null
    }>

    const insert = brain.prepare(`
      INSERT INTO llm_calls (source, model, prompt_tokens, completion_tokens, total_tokens, tool_names, duration_ms, created_at, session_id, cost, message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const row of rows) {
      insert.run(
        row.source,
        row.model,
        row.prompt_tokens,
        row.completion_tokens,
        row.total_tokens,
        row.tool_names,
        row.duration_ms,
        row.created_at,
        row.session_id,
        row.cost,
        row.message_id,
      )
      llmCallsCount++
    }
  } catch (err) {
    logger.error({ err }, 'Failed to migrate llm_calls table')
  }

  // Migrate pr_agent_results
  try {
    const rows = old
      .prepare('SELECT project_id, mr_iid, tool, head_sha, result, created_at FROM pr_agent_results')
      .all() as Array<{
      project_id: number
      mr_iid: number
      tool: string
      head_sha: string
      result: string
      created_at: string
    }>

    const insert = brain.prepare(`
      INSERT INTO pr_agent_results (project_id, mr_iid, tool, head_sha, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    for (const row of rows) {
      insert.run(row.project_id, row.mr_iid, row.tool, row.head_sha, row.result, row.created_at)
      prAgentCount++
    }
  } catch (err) {
    logger.error({ err }, 'Failed to migrate pr_agent_results table')
  }

  // Migrate processed_emails (might not exist in old DB)
  try {
    const rows = old
      .prepare('SELECT message_id, thread_id, processed_at, action FROM processed_emails')
      .all() as Array<{
      message_id: string
      thread_id: string | null
      processed_at: string
      action: string | null
    }>

    const insert = brain.prepare(`
      INSERT OR IGNORE INTO processed_emails (message_id, thread_id, processed_at, action)
      VALUES (?, ?, ?, ?)
    `)

    for (const row of rows) {
      insert.run(row.message_id, row.thread_id, row.processed_at, row.action)
      emailsCount++
    }
  } catch (err) {
    logger.error({ err }, 'Failed to migrate processed_emails table (may not exist)')
  }

  // Rebuild FTS index
  try {
    brain.prepare("INSERT INTO memories_fts(memories_fts) VALUES('rebuild')").run()
  } catch (err) {
    logger.error({ err }, 'Failed to rebuild FTS index')
  }

  old.close()

  // Rename old DB so migration doesn't run again
  try {
    renameSync(oldPath, resolve(DATA_DIR, 'memory.db.migrated'))
  } catch (err) {
    logger.error({ err }, 'Failed to rename memory.db after migration')
  }

  logger.info(
    `Brain migration complete — memories: ${memoriesCount}, llm_calls: ${llmCallsCount}, pr_agent_results: ${prAgentCount}, processed_emails: ${emailsCount}`,
  )
}
