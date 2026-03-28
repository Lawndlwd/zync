import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { logger } from '../../lib/logger.js'

const DB_PATH = resolve(import.meta.dirname, '../../../data/memory.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initDb(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      category,
      content='memories',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content, category)
      VALUES (new.id, new.content, new.category);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, category)
      VALUES ('delete', old.id, old.content, old.category);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content, category)
      VALUES ('delete', old.id, old.content, old.category);
      INSERT INTO memories_fts(rowid, content, category)
      VALUES (new.id, new.content, new.category);
    END;

    CREATE TABLE IF NOT EXISTS llm_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL DEFAULT 'chat',
      model TEXT NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      tool_names TEXT DEFAULT '[]',
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_llm_calls_created_at ON llm_calls(created_at);
    CREATE INDEX IF NOT EXISTS idx_llm_calls_source ON llm_calls(source);
  `)

  // Migrate: add session_id and cost columns to llm_calls
  const llmCallsInfo = db.prepare('PRAGMA table_info(llm_calls)').all() as Array<{ name: string }>
  const columns = llmCallsInfo.map((c) => c.name)
  if (!columns.includes('session_id')) {
    db.exec(`ALTER TABLE llm_calls ADD COLUMN session_id TEXT`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_llm_calls_session_id ON llm_calls(session_id)`)
  }
  if (!columns.includes('cost')) {
    db.exec(`ALTER TABLE llm_calls ADD COLUMN cost REAL`)
  }
  if (!columns.includes('message_id')) {
    db.exec(`ALTER TABLE llm_calls ADD COLUMN message_id TEXT`)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_llm_calls_message_id ON llm_calls(message_id)`)
  }

  // Migrate: drop old table with UNIQUE constraint, recreate without it (allows history)
  const hasUniqueConstraint = db
    .prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name='pr_agent_results'
  `)
    .get() as { sql: string } | undefined
  if (hasUniqueConstraint?.sql?.includes('UNIQUE')) {
    db.exec(`
      ALTER TABLE pr_agent_results RENAME TO pr_agent_results_old;
      CREATE TABLE pr_agent_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        mr_iid INTEGER NOT NULL,
        tool TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO pr_agent_results (id, project_id, mr_iid, tool, head_sha, result, created_at)
        SELECT id, project_id, mr_iid, tool, head_sha, result, created_at FROM pr_agent_results_old;
      DROP TABLE pr_agent_results_old;
    `)
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pr_agent_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        mr_iid INTEGER NOT NULL,
        tool TEXT NOT NULL,
        head_sha TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `)
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pr_agent_results_mr
      ON pr_agent_results(project_id, mr_iid);
  `)

  // Migrate: add vector search and evolving memory columns
  const memoriesInfo = db.prepare('PRAGMA table_info(memories)').all() as Array<{ name: string }>
  const memCols = memoriesInfo.map((c) => c.name)
  if (!memCols.includes('embedding')) {
    db.exec(`ALTER TABLE memories ADD COLUMN embedding BLOB`)
  }
  if (!memCols.includes('access_count')) {
    db.exec(`ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0`)
  }
  if (!memCols.includes('last_accessed')) {
    db.exec(`ALTER TABLE memories ADD COLUMN last_accessed TEXT`)
  }
  if (!memCols.includes('relevance_score')) {
    db.exec(`ALTER TABLE memories ADD COLUMN relevance_score REAL DEFAULT 1.0`)
  }
  if (!memCols.includes('embedding_model')) {
    db.exec(`ALTER TABLE memories ADD COLUMN embedding_model TEXT`)
  }

  // Processed emails table for Gmail integration
  db.exec(`
    CREATE TABLE IF NOT EXISTS processed_emails (
      message_id TEXT PRIMARY KEY,
      thread_id TEXT,
      processed_at TEXT DEFAULT (datetime('now')),
      action TEXT
    );
  `)

  logger.info('Memory database initialized')
}
