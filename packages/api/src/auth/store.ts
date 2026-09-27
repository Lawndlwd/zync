import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { codeOf, conflict, notFound } from '@zync/jobs'
import { z } from 'zod'

import { hashSecret, humanCode, normalizeCode, randomToken } from './crypto.js'

// The one user's passkeys, recovery codes and sessions, in one JSON file (0600, in a 0700 folder).
// Secrets are never stored: sessions and recovery codes are kept as SHA-256 hashes, passkeys as
// public keys. A file that doesn't parse stops the app (fail closed) rather than starting empty.

const CredentialSchema = z.object({
  /** base64url credential id */
  id: z.string().min(1),
  /** base64url COSE public key */
  publicKey: z.string().min(1),
  counter: z.number().int().min(0),
  transports: z.array(z.string()),
  name: z.string(),
  createdAt: z.number(),
  lastUsedAt: z.number().optional(),
})
export type Credential = z.infer<typeof CredentialSchema>

const SessionSchema = z.object({
  /** Public id, to list and revoke a session; the token itself is only in the browser's cookie. */
  id: z.string(),
  tokenHash: z.string(),
  createdAt: z.number(),
  lastSeenAt: z.number(),
  /** Last passkey (or recovery code) check, for actions that need a recent one. */
  authAt: z.number(),
  ip: z.string(),
  userAgent: z.string(),
})
export type Session = z.infer<typeof SessionSchema>

const AuthFileSchema = z.object({
  /** WebAuthn user handle (random, not personal). */
  userId: z.string(),
  credentials: z.array(CredentialSchema),
  recoveryHashes: z.array(z.string()),
  sessions: z.array(SessionSchema),
})
type AuthFile = z.infer<typeof AuthFileSchema>

const FILE = 'auth.json'
const MAX_SESSIONS = 20
const RECOVERY_CODES = 10
/** lastSeenAt is written at most this often, so reads don't rewrite the file every request. */
const TOUCH_MS = 60_000

export type SessionTiming = { idleMs: number; maxAgeMs: number }

export class AuthStore {
  private data: Promise<AuthFile> | null = null
  private writing: Promise<void> = Promise.resolve()

  constructor(
    private readonly dir: string,
    private readonly timing: SessionTiming,
    private readonly now: () => number = Date.now,
  ) {}

  private async read(): Promise<AuthFile> {
    let src: string
    try {
      src = await readFile(path.join(this.dir, FILE), 'utf8')
    } catch (err) {
      if (codeOf(err) === 'ENOENT')
        return { userId: randomToken(16), credentials: [], recoveryHashes: [], sessions: [] }
      throw err
    }
    return AuthFileSchema.parse(JSON.parse(src))
  }

  private async load(): Promise<AuthFile> {
    this.data ??= this.read()
    return this.data
  }

  /** Replace the file atomically (write a temporary file, then rename), private to this user. */
  private async persist(snapshot: string): Promise<void> {
    await mkdir(this.dir, { recursive: true, mode: 0o700 })
    await chmod(this.dir, 0o700)
    const tmp = path.join(this.dir, `${FILE}.${process.pid}.tmp`)
    await writeFile(tmp, snapshot, { mode: 0o600 })
    await rename(tmp, path.join(this.dir, FILE))
  }

  /** Change the data and persist it; changes are applied one after the other. */
  private async update<T>(fn: (d: AuthFile) => T): Promise<T> {
    const d = await this.load()
    const result = fn(d)
    const snapshot = `${JSON.stringify(d, null, 2)}\n`
    const write = this.writing.then(() => this.persist(snapshot))
    this.writing = write.catch(() => {})
    await write
    return result
  }

  async userId(): Promise<string> {
    return (await this.load()).userId
  }

  // ── passkeys ──

  async credentials(): Promise<Credential[]> {
    return (await this.load()).credentials
  }

  async hasCredentials(): Promise<boolean> {
    return (await this.load()).credentials.length > 0
  }

  async addCredential(c: Omit<Credential, 'createdAt'>): Promise<Credential> {
    return this.update((d) => {
      if (d.credentials.some((x) => x.id === c.id)) throw conflict('This passkey is already registered')
      const cred = { ...c, createdAt: this.now() }
      d.credentials.push(cred)
      return cred
    })
  }

  /** Record a successful use: the authenticator's new signature counter and when. */
  async useCredential(id: string, counter: number): Promise<void> {
    await this.update((d) => {
      const c = d.credentials.find((x) => x.id === id)
      if (!c) throw notFound('Unknown passkey')
      c.counter = counter
      c.lastUsedAt = this.now()
    })
  }

  /** Remove a passkey. The last one can't be removed: there would be no way back in. */
  async removeCredential(id: string): Promise<void> {
    await this.update((d) => {
      if (!d.credentials.some((x) => x.id === id)) throw notFound('Unknown passkey')
      if (d.credentials.length === 1) throw conflict('This is your only passkey: add another one first')
      d.credentials = d.credentials.filter((x) => x.id !== id)
    })
  }

  // ── sessions ──

  /** A new session; the token is returned once, for the cookie. */
  async createSession(meta: { ip: string; userAgent: string }): Promise<{ token: string; session: Session }> {
    const token = randomToken()
    const now = this.now()
    const session: Session = {
      id: randomToken(9),
      tokenHash: hashSecret(token),
      createdAt: now,
      lastSeenAt: now,
      authAt: now,
      ip: meta.ip,
      userAgent: meta.userAgent.slice(0, 300),
    }
    await this.update((d) => {
      d.sessions = [...this.live(d.sessions), session].slice(-MAX_SESSIONS)
    })
    return { token, session }
  }

  private live(sessions: Session[]): Session[] {
    const now = this.now()
    return sessions.filter((s) => now - s.lastSeenAt < this.timing.idleMs && now - s.createdAt < this.timing.maxAgeMs)
  }

  /** The live session for a cookie token, or null (unknown, idle too long, or too old). */
  async findSession(token: string): Promise<Session | null> {
    const hash = hashSecret(token)
    const d = await this.load()
    const s = this.live(d.sessions).find((x) => x.tokenHash === hash)
    if (!s) return null
    if (this.now() - s.lastSeenAt > TOUCH_MS) {
      await this.update((f) => {
        f.sessions = this.live(f.sessions)
        const cur = f.sessions.find((x) => x.id === s.id)
        if (cur) cur.lastSeenAt = this.now()
      })
    }
    return s
  }

  async sessions(): Promise<Session[]> {
    return this.live((await this.load()).sessions)
  }

  /** The session just passed a passkey check again. */
  async stepUp(id: string): Promise<void> {
    await this.update((d) => {
      const s = d.sessions.find((x) => x.id === id)
      if (s) s.authAt = this.now()
    })
  }

  async revokeSession(id: string): Promise<void> {
    await this.update((d) => {
      d.sessions = d.sessions.filter((x) => x.id !== id)
    })
  }

  /** Sign out every other device (`keep`), or everywhere when omitted. */
  async revokeSessions(keep?: string): Promise<number> {
    return this.update((d) => {
      const before = d.sessions.length
      d.sessions = d.sessions.filter((x) => x.id === keep)
      return before - d.sessions.length
    })
  }

  // ── recovery codes ──

  /** Replace the recovery codes; the new ones are returned once and only their hashes are kept. */
  async newRecoveryCodes(): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODES }, humanCode)
    await this.update((d) => {
      d.recoveryHashes = codes.map((c) => hashSecret(normalizeCode(c)))
    })
    return codes
  }

  async recoveryCodesLeft(): Promise<number> {
    return (await this.load()).recoveryHashes.length
  }

  /** Use a recovery code: true (and it can't be used again) when it is one of ours. */
  async consumeRecoveryCode(code: string): Promise<boolean> {
    const hash = hashSecret(normalizeCode(code))
    return this.update((d) => {
      const i = d.recoveryHashes.indexOf(hash)
      if (i < 0) return false
      d.recoveryHashes.splice(i, 1)
      return true
    })
  }
}
