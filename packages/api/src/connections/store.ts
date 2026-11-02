import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { type Connection, codeOf, notFound, PROVIDERS } from '@zync/jobs'
import { z } from 'zod'

// Connected accounts and their login secrets, in one JSON file (0600, in a 0700 folder) under
// ZYNC_CONNECTIONS_DIR: a volume only the api mounts, never a workspace the AI can read. The secrets
// have to be usable (they sign requests to Google, Slack, Telegram), so unlike passkeys they are
// stored as they are; they never leave this process.

const GoogleSecret = z.object({ provider: z.literal('google'), refreshToken: z.string().min(1) })
const SlackSecret = z.object({
  provider: z.literal('slack'),
  token: z.string().min(1),
  userId: z.string(),
  teamId: z.string(),
  url: z.string(),
})
const TelegramSecret = z.object({
  provider: z.literal('telegram'),
  apiId: z.number().int(),
  apiHash: z.string().min(1),
  session: z.string().min(1),
})
const SecretSchema = z.discriminatedUnion('provider', [GoogleSecret, SlackSecret, TelegramSecret])
export type Secret = z.infer<typeof SecretSchema>
export type SecretOf<P extends Secret['provider']> = Extract<Secret, { provider: P }>

const StoredSchema = z.object({
  id: z.string(),
  provider: z.enum(PROVIDERS),
  label: z.string(),
  account: z.string(),
  createdAt: z.number(),
  error: z.string().optional(),
  secret: SecretSchema,
})
type Stored = z.infer<typeof StoredSchema>

const FileSchema = z.object({ connections: z.array(StoredSchema) })
type ConnectionsFile = z.infer<typeof FileSchema>

const FILE = 'connections.json'

/** What may leave the store: everything but the secret. */
const publicOf = ({ secret: _secret, ...c }: Stored): Connection => c

export class ConnectionStore {
  private data: Promise<ConnectionsFile> | null = null
  private writing: Promise<void> = Promise.resolve()

  constructor(
    private readonly dir: string,
    private readonly now: () => number = Date.now,
  ) {}

  private async read(): Promise<ConnectionsFile> {
    let src: string
    try {
      src = await readFile(path.join(this.dir, FILE), 'utf8')
    } catch (err) {
      if (codeOf(err) === 'ENOENT') return { connections: [] }
      throw err
    }
    return FileSchema.parse(JSON.parse(src))
  }

  private async load(): Promise<ConnectionsFile> {
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
  private async update<T>(fn: (d: ConnectionsFile) => T): Promise<T> {
    const d = await this.load()
    const result = fn(d)
    const snapshot = `${JSON.stringify(d, null, 2)}\n`
    const write = this.writing.then(() => this.persist(snapshot))
    this.writing = write.catch(() => {})
    await write
    return result
  }

  private static find(d: ConnectionsFile, id: string): Stored {
    const c = d.connections.find((x) => x.id === id)
    if (!c) throw notFound('Unknown connection')
    return c
  }

  async list(): Promise<Connection[]> {
    return (await this.load()).connections.map(publicOf)
  }

  /** The connection with its secret, for the adapters only. */
  async get(id: string): Promise<Connection & { secret: Secret }> {
    return ConnectionStore.find(await this.load(), id)
  }

  /** Every connection of a provider, with its secret, for the adapters only. */
  async ofProvider<P extends Secret['provider']>(provider: P): Promise<Array<Connection & { secret: SecretOf<P> }>> {
    const isOf = (s: Secret): s is SecretOf<P> => s.provider === provider
    return (await this.load()).connections.flatMap(({ secret, ...c }) => (isOf(secret) ? [{ ...c, secret }] : []))
  }

  /**
   * Add an account, or refresh its secret when the same account of the same provider is connected
   * again (a new login replaces the old one, the label is kept).
   */
  async save(input: { account: string; label?: string; secret: Secret }): Promise<Connection> {
    return this.update((d) => {
      const provider = input.secret.provider
      const same = d.connections.find((c) => c.provider === provider && c.account === input.account)
      if (same) {
        same.secret = input.secret
        delete same.error
        return publicOf(same)
      }
      const c: Stored = {
        id: randomUUID(),
        provider,
        label: input.label?.trim() || input.account,
        account: input.account,
        createdAt: this.now(),
        secret: input.secret,
      }
      d.connections.push(c)
      return publicOf(c)
    })
  }

  async rename(id: string, label: string): Promise<Connection> {
    return this.update((d) => {
      const c = ConnectionStore.find(d, id)
      c.label = label.trim() || c.account
      return publicOf(c)
    })
  }

  async remove(id: string): Promise<void> {
    await this.update((d) => {
      ConnectionStore.find(d, id)
      d.connections = d.connections.filter((c) => c.id !== id)
    })
  }

  /** Remember that a read failed (or worked again: `error` undefined). Written only on change. */
  async setError(id: string, error: string | undefined): Promise<void> {
    const c = (await this.load()).connections.find((x) => x.id === id)
    if (!c || c.error === error) return
    await this.update((d) => {
      const x = d.connections.find((y) => y.id === id)
      if (!x) return
      if (error) x.error = error
      else delete x.error
    })
  }
}
