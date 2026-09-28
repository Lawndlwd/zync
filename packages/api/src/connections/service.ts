import { randomBytes } from 'node:crypto'

import {
  type ChatMessage,
  type ChatSummary,
  type Connection,
  errorMessage,
  type ExternalEvent,
  type Gathered,
  httpError,
  type MailItem,
  type MailMessage,
  type Provider,
} from '@zync/jobs'

import { listMail, readMail } from './gmail.js'
import { type GoogleClient, googleAuthUrl, googleExchange, GoogleTokens } from './google-auth.js'
import { listEvents } from './google-calendar.js'
import { slackIdentify, slackUnread } from './slack.js'
import { ConnectionStore, type SecretOf } from './store.js'
import { type TelegramLoggedIn, TelegramLogins, TelegramReader } from './telegram.js'

// Everything the routes need about connected accounts: adding them (each provider's login),
// listing, renaming, removing, and reading from all of them at once. A read that fails for one
// account doesn't fail the others: it is reported under `failed` and shown in Settings.

export type ConnectionsOptions = {
  /** Folder of connections.json, only the api can read it (ZYNC_CONNECTIONS_DIR). */
  dir: string
  /** Google OAuth client; without it, Google accounts can't be connected. */
  google?: GoogleClient | undefined
  now?: () => number
}

const DAY = 24 * 60 * 60_000
/** A Google sign-in has this long to come back. */
const STATE_MS = 10 * 60_000

export class Connections {
  readonly store: ConnectionStore
  private readonly google: GoogleClient | undefined
  private readonly tokens: GoogleTokens | undefined
  private readonly states = new Map<string, { until: number; back: string }>()
  private readonly telegramLogins: TelegramLogins
  private readonly telegram = new TelegramReader()
  private readonly now: () => number

  constructor(opts: ConnectionsOptions) {
    this.now = opts.now ?? Date.now
    this.store = new ConnectionStore(opts.dir, this.now)
    this.google = opts.google
    this.tokens = opts.google ? new GoogleTokens(opts.google, this.now) : undefined
    this.telegramLogins = new TelegramLogins(this.now)
  }

  /** Which providers can be connected here (Google needs its OAuth client configured). */
  available(): Record<Provider, boolean> {
    return { google: Boolean(this.google), slack: true, telegram: true }
  }

  list(): Promise<Connection[]> {
    return this.store.list()
  }

  rename(id: string, label: string): Promise<Connection> {
    return this.store.rename(id, label)
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(id)
    this.tokens?.forget(id)
    await this.telegram.forget(id)
  }

  // ── adding accounts ──

  private googleClient(): GoogleClient {
    if (!this.google)
      throw httpError(503, 'Google is not set up: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are missing')
    return this.google
  }

  /** Where to send the browser to connect a Google account; it comes back to `back` (an app page). */
  googleStart(back: string): string {
    const client = this.googleClient()
    if (!/^\/w\/[^/]/.test(back) || back.includes('//') || back.includes('\\'))
      throw httpError(400, 'back must be a page of the app')
    const now = this.now()
    for (const [s, v] of this.states) if (v.until < now) this.states.delete(s)
    const state = randomBytes(24).toString('base64url')
    this.states.set(state, { until: now + STATE_MS, back })
    return googleAuthUrl(client, state)
  }

  /**
   * Google sent the browser back. The state must be one we issued, once, recently: it is what proves
   * the sign-in was started from the app (the callback itself arrives without the session cookie).
   * Returns the page to go back to.
   */
  async googleFinish(q: { code?: string; state?: string; error?: string }): Promise<{ back: string; error?: string }> {
    const issued = q.state ? this.states.get(q.state) : undefined
    if (q.state) this.states.delete(q.state)
    if (!issued || issued.until < this.now())
      throw httpError(400, 'This Google sign-in expired or was already used: try again')
    if (q.error || !q.code)
      return {
        back: issued.back,
        error: q.error === 'access_denied' ? 'Google access was refused' : (q.error ?? 'No code from Google'),
      }
    try {
      const { email, refreshToken } = await googleExchange(this.googleClient(), q.code)
      const c = await this.store.save({ account: email, secret: { provider: 'google', refreshToken } })
      this.tokens?.forget(c.id)
      return { back: issued.back }
    } catch (err) {
      return { back: issued.back, error: errorMessage(err) }
    }
  }

  async slackAdd(token: string, label?: string): Promise<Connection> {
    const { account, secret } = await slackIdentify(token.trim())
    return this.store.save({ account, label, secret })
  }

  telegramStart(apiId: number, apiHash: string, phone: string): Promise<string> {
    return this.telegramLogins.start({ apiId, apiHash: apiHash.trim() }, phone.replaceAll(/[\s-]/g, ''))
  }

  async telegramCode(login: string, code: string): Promise<Connection | 'password'> {
    const r = await this.telegramLogins.code(login, code)
    return r === 'password' ? r : this.telegramSave(r)
  }

  async telegramPassword(login: string, password: string): Promise<Connection> {
    return this.telegramSave(await this.telegramLogins.password(login, password))
  }

  private async telegramSave(r: TelegramLoggedIn): Promise<Connection> {
    const c = await this.store.save(r)
    await this.telegram.forget(c.id)
    return c
  }

  // ── reading ──

  /** Run `read` on each connection in parallel; failures are collected (and shown in Settings). */
  private async gather<P extends Provider, T>(
    provider: P,
    only: string | undefined,
    read: (c: Connection, secret: SecretOf<P>) => Promise<T[]>,
  ): Promise<Gathered<T>> {
    const all = (await this.store.ofProvider(provider)).filter((c) => !only || c.id === only)
    const results = await Promise.all(
      all.map(async ({ secret, ...c }) => {
        try {
          const items = await read(c, secret)
          await this.store.setError(c.id, undefined)
          return { items, failed: [] }
        } catch (err) {
          const error = errorMessage(err)
          await this.store.setError(c.id, error)
          return { items: [], failed: [{ connection: c.id, account: c.account, error }] }
        }
      }),
    )
    return { items: results.flatMap((r) => r.items), failed: results.flatMap((r) => r.failed) }
  }

  private since(since: string | undefined): Date {
    const d = since ? new Date(since) : new Date(this.now() - DAY)
    if (Number.isNaN(d.getTime())) throw httpError(400, 'since must be an ISO date-time')
    return d
  }

  private token(c: Connection, secret: SecretOf<'google'>): Promise<string> {
    if (!this.tokens) throw httpError(503, 'Google is not set up on this server')
    return this.tokens.get(c.id, secret.refreshToken)
  }

  async mail(q: {
    since?: string | undefined
    query?: string | undefined
    connection?: string | undefined
    limit?: number | undefined
  }): Promise<Gathered<MailItem>> {
    const since = this.since(q.since)
    const limit = Math.min(Math.max(q.limit ?? 20, 1), 50)
    const r = await this.gather('google', q.connection, async (c, secret) =>
      listMail(c, await this.token(c, secret), { since, query: q.query, limit }),
    )
    return { ...r, items: r.items.toSorted((a, b) => b.date.localeCompare(a.date)) }
  }

  async readMail(connection: string, id: string): Promise<MailMessage> {
    const { secret, ...c } = await this.store.get(connection)
    if (secret.provider !== 'google') throw httpError(400, 'Not a Google connection')
    return readMail(c, await this.token(c, secret), id)
  }

  async events(from: string, to: string): Promise<Gathered<ExternalEvent>> {
    const day = /^\d{4}-\d{2}-\d{2}$/
    if (!day.test(from) || !day.test(to)) throw httpError(400, 'from and to must look like 2026-09-28')
    const r = await this.gather('google', undefined, async (c, secret) =>
      listEvents(c, await this.token(c, secret), from, to),
    )
    return { ...r, items: r.items.toSorted((a, b) => a.start.localeCompare(b.start)) }
  }

  async messages(q: {
    since?: string | undefined
    provider?: 'slack' | 'telegram' | undefined
    connection?: string | undefined
  }): Promise<Gathered<ChatMessage>> {
    const since = this.since(q.since)
    const [slack, telegram] = await Promise.all([
      q.provider === 'telegram'
        ? { items: [], failed: [] }
        : this.gather('slack', q.connection, (c, secret) => slackUnread(c, secret, since)),
      q.provider === 'slack'
        ? { items: [], failed: [] }
        : this.gather('telegram', q.connection, (c, secret) => this.telegram.unread(c, secret)),
    ])
    return {
      items: [...slack.items, ...telegram.items].toSorted((a, b) => b.date.localeCompare(a.date)),
      failed: [...slack.failed, ...telegram.failed],
    }
  }

  /** Every Telegram conversation (most recent first), with its unread count. */
  async chats(connection?: string): Promise<Gathered<ChatSummary>> {
    return this.gather('telegram', connection, (c, secret) => this.telegram.chats(c, secret))
  }

  /** The latest messages of one chat, read or not (nothing is marked as read). */
  async readChat(connection: string, chat: string, limit = 20): Promise<ChatMessage[]> {
    const { secret, ...c } = await this.store.get(connection)
    if (secret.provider !== 'telegram') throw httpError(400, 'Reading a chat works for Telegram connections')
    return this.telegram.read(c, secret, chat, Math.min(Math.max(limit, 1), 100))
  }
}
