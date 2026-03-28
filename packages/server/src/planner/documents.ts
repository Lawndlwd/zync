import { logger } from '../lib/logger.js'
import { getPlannerDb } from './db.js'

export function initDocumentTables(): void {
  const db = getPlannerDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS blocksuite_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT UNIQUE NOT NULL,
      root_doc_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocksuite_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT UNIQUE NOT NULL,
      document_state BLOB NOT NULL,
      version INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocksuite_blobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blob_id TEXT UNIQUE NOT NULL,
      blob_data BLOB NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)

  logger.info('BlockSuite document tables initialized')
}

// --- Root document ---

export function insertRoot(docId: string): { docId: string } {
  const db = getPlannerDb()
  const existing = db
    .prepare('SELECT doc_id FROM blocksuite_docs WHERE root_doc_id IS NULL AND doc_id LIKE ?')
    .get('root-%') as { doc_id: string } | undefined
  if (existing) {
    return { docId: existing.doc_id }
  }
  db.prepare('INSERT OR IGNORE INTO blocksuite_docs (doc_id, root_doc_id) VALUES (?, NULL)').run(docId)
  return { docId }
}

export function getRootDocId(): string | null {
  const db = getPlannerDb()
  const row = db
    .prepare('SELECT doc_id FROM blocksuite_docs WHERE root_doc_id IS NULL AND doc_id LIKE ?')
    .get('root-%') as { doc_id: string } | undefined
  return row?.doc_id ?? null
}

// --- Child documents ---

export function insertDoc(docId: string, rootDocId: string): void {
  const db = getPlannerDb()
  db.prepare('INSERT OR IGNORE INTO blocksuite_docs (doc_id, root_doc_id) VALUES (?, ?)').run(docId, rootDocId)
}

// --- Snapshots ---

export function insertSnapshot(docId: string, documentState: Buffer | Uint8Array): void {
  const db = getPlannerDb()
  const buf = Buffer.from(documentState)
  const existing = db.prepare('SELECT id FROM blocksuite_snapshots WHERE doc_id = ?').get(docId)
  if (existing) {
    db.prepare(
      "UPDATE blocksuite_snapshots SET document_state = ?, version = version + 1, updated_at = datetime('now') WHERE doc_id = ?",
    ).run(buf, docId)
  } else {
    db.prepare('INSERT INTO blocksuite_snapshots (doc_id, document_state) VALUES (?, ?)').run(docId, buf)
  }
}

export function getSnapshot(docId: string): { document_state: number[] } | null {
  const db = getPlannerDb()
  const row = db.prepare('SELECT document_state FROM blocksuite_snapshots WHERE doc_id = ?').get(docId) as
    | { document_state: Buffer }
    | undefined
  if (!row) return null
  return { document_state: Array.from(row.document_state) }
}

// --- Blobs ---

export function insertBlob(blobId: string, blobData: Buffer): void {
  const db = getPlannerDb()
  db.prepare('INSERT OR REPLACE INTO blocksuite_blobs (blob_id, blob_data) VALUES (?, ?)').run(blobId, blobData)
}

export function getBlob(blobId: string): Buffer | null {
  const db = getPlannerDb()
  const row = db.prepare('SELECT blob_data FROM blocksuite_blobs WHERE blob_id = ?').get(blobId) as
    | { blob_data: Buffer }
    | undefined
  return row?.blob_data ?? null
}

export function deleteBlob(blobId: string): void {
  getPlannerDb().prepare('DELETE FROM blocksuite_blobs WHERE blob_id = ?').run(blobId)
}

export function getAllBlobIds(): string[] {
  const db = getPlannerDb()
  const rows = db.prepare('SELECT blob_id FROM blocksuite_blobs').all() as { blob_id: string }[]
  return rows.map((r) => r.blob_id)
}

// --- Metadata & counts ---

export function getDocumentsMetadata(): Array<{
  docId: string
  rootDocId: string | null
  hasSnapshot: boolean
  createdAt: string
  updatedAt: string
}> {
  const db = getPlannerDb()
  const rows = db
    .prepare(`
    SELECT d.doc_id, d.root_doc_id, d.created_at, d.updated_at,
           CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END as has_snapshot
    FROM blocksuite_docs d
    LEFT JOIN blocksuite_snapshots s ON s.doc_id = d.doc_id
    ORDER BY d.created_at ASC
  `)
    .all() as any[]

  return rows.map((r) => ({
    docId: r.doc_id,
    rootDocId: r.root_doc_id,
    hasSnapshot: !!r.has_snapshot,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))
}

export function getDocumentCount(): number {
  const db = getPlannerDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM blocksuite_docs').get() as { count: number }
  return row.count
}
