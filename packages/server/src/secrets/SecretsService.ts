import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'

const DEFAULT_DB_PATH = resolve(import.meta.dirname, '../../data/secrets.db')

export class SecretsService {
  private db: Database.Database
  private key: Buffer

  constructor(secretKey: string, dbPath: string = DEFAULT_DB_PATH) {
    if (!secretKey || secretKey.length < 32) {
      throw new Error('SECRET_KEY must be at least 32 characters. Generate with: openssl rand -hex 32')
    }

    const salt = 'zync-vault-v1'
    this.key = crypto.scryptSync(secretKey, salt, 32)

    mkdirSync(dirname(dbPath), { recursive: true })
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS secrets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT DEFAULT 'general',
        iv TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_secrets_name ON secrets(name);
      CREATE INDEX IF NOT EXISTS idx_secrets_category ON secrets(category);
    `)
  }

  private encrypt(plaintext: string): { iv: string; ciphertext: string; authTag: string } {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return {
      iv: iv.toString('hex'),
      ciphertext: encrypted.toString('hex'),
      authTag: authTag.toString('hex'),
    }
  }

  private decrypt(iv: string, ciphertext: string, authTag: string): string {
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()])
    return decrypted.toString('utf8')
  }

  get(name: string): string | null {
    const row = this.db.prepare('SELECT iv, ciphertext, auth_tag FROM secrets WHERE name = ?').get(name) as
      | { iv: string; ciphertext: string; auth_tag: string }
      | undefined

    if (!row) return null
    return this.decrypt(row.iv, row.ciphertext, row.auth_tag)
  }

  set(name: string, value: string, category: string = 'general'): void {
    const { iv, ciphertext, authTag } = this.encrypt(value)
    this.db
      .prepare(`
      INSERT INTO secrets (name, category, iv, ciphertext, auth_tag)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        category = excluded.category,
        iv = excluded.iv,
        ciphertext = excluded.ciphertext,
        auth_tag = excluded.auth_tag,
        updated_at = datetime('now')
    `)
      .run(name, category, iv, ciphertext, authTag)
  }

  delete(name: string): boolean {
    const result = this.db.prepare('DELETE FROM secrets WHERE name = ?').run(name)
    return result.changes > 0
  }

  list(category?: string): Array<{ name: string; category: string; createdAt: string; updatedAt: string }> {
    const query = category
      ? 'SELECT name, category, created_at, updated_at FROM secrets WHERE category = ? ORDER BY name'
      : 'SELECT name, category, created_at, updated_at FROM secrets ORDER BY name'
    const rows = category ? this.db.prepare(query).all(category) : this.db.prepare(query).all()
    return (rows as Array<{ name: string; category: string; created_at: string; updated_at: string }>).map((r) => ({
      name: r.name,
      category: r.category,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  has(name: string): boolean {
    const row = this.db.prepare('SELECT 1 FROM secrets WHERE name = ?').get(name)
    return !!row
  }

  // --- PIN management ---

  private ensurePinTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vault_pin (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pin_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `)
  }

  hasPin(): boolean {
    this.ensurePinTable()
    const row = this.db.prepare('SELECT 1 FROM vault_pin WHERE id = 1').get()
    return !!row
  }

  setPin(pin: string): void {
    if (!/^\d{6}$/.test(pin)) throw new Error('PIN must be exactly 6 digits')
    this.ensurePinTable()
    const pinHash = crypto.scryptSync(pin, 'zync-vault-pin-v1', 32).toString('hex')
    this.db
      .prepare(`
      INSERT INTO vault_pin (id, pin_hash) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET pin_hash = excluded.pin_hash, created_at = datetime('now')
    `)
      .run(pinHash)
  }

  verifyPin(pin: string): boolean {
    this.ensurePinTable()
    const row = this.db.prepare('SELECT pin_hash FROM vault_pin WHERE id = 1').get() as { pin_hash: string } | undefined
    if (!row) return false
    const inputHash = crypto.scryptSync(pin, 'zync-vault-pin-v1', 32).toString('hex')
    const a = Buffer.from(inputHash, 'hex')
    const b = Buffer.from(row.pin_hash, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  close(): void {
    this.db.close()
  }
}
