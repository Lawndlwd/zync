import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { logger } from '../lib/logger.js'

const DB_PATH = resolve(import.meta.dirname, '../../data/brain.db')

export function getBrainDbPath(): string {
  return DB_PATH
}

let db: Database.Database | null = null

export function getBrainDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

/**
 * Checkpoint WAL to ensure cross-process writes are visible.
 * Call before reads that need to see data written by the MCP server process.
 */
export function checkpointBrainDb(): void {
  if (db) {
    try { db.pragma('wal_checkpoint(PASSIVE)') } catch { /* ignore */ }
  }
}

export function initBrainDb(): void {
  const db = getBrainDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS core_profile (
      section    TEXT PRIMARY KEY,
      content    TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS instructions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      content    TEXT NOT NULL,
      source     TEXT DEFAULT 'explicit',
      active     INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS memories (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      content         TEXT NOT NULL,
      category        TEXT DEFAULT 'general',
      source          TEXT DEFAULT 'tool',
      embedding       BLOB,
      embedding_model TEXT,
      access_count    INTEGER DEFAULT 0,
      last_accessed   TEXT,
      relevance_score REAL DEFAULT 1.0,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
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
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      source            TEXT NOT NULL DEFAULT 'chat',
      model             TEXT NOT NULL,
      prompt_tokens     INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens      INTEGER DEFAULT 0,
      tool_names        TEXT DEFAULT '[]',
      duration_ms       INTEGER DEFAULT 0,
      session_id        TEXT,
      message_id        TEXT,
      cost              REAL,
      created_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_llm_calls_created_at ON llm_calls(created_at);
    CREATE INDEX IF NOT EXISTS idx_llm_calls_source ON llm_calls(source);
    CREATE INDEX IF NOT EXISTS idx_llm_calls_session_id ON llm_calls(session_id);
    CREATE INDEX IF NOT EXISTS idx_llm_calls_message_id ON llm_calls(message_id);

    CREATE TABLE IF NOT EXISTS pr_agent_results (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      mr_iid     INTEGER NOT NULL,
      tool       TEXT NOT NULL,
      head_sha   TEXT NOT NULL,
      result     TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_pr_agent_results_mr
      ON pr_agent_results(project_id, mr_iid);

    CREATE TABLE IF NOT EXISTS processed_emails (
      message_id   TEXT PRIMARY KEY,
      thread_id    TEXT,
      processed_at TEXT DEFAULT (datetime('now')),
      action       TEXT
    );
  `)

  const count = db.prepare('SELECT COUNT(*) as cnt FROM core_profile').get() as { cnt: number }
  if (count.cnt === 0) {
    const insert = db.prepare('INSERT INTO core_profile (section) VALUES (?)')
    const sections = ['identity', 'technical', 'interests', 'communication', 'work_patterns']
    for (const section of sections) {
      insert.run(section)
    }
  }

  logger.info('Brain database initialized')
}

export function closeBrainDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
