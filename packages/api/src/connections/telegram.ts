import { randomUUID } from 'node:crypto'

import { type ChatMessage, type ChatSummary, type Connection, httpError, notFound } from '@zync/jobs'
import { Api, Logger, sessions, TelegramClient } from 'telegram'
import { LogLevel } from 'telegram/extensions/Logger.js'
import type { Dialog } from 'telegram/tl/custom/dialog.js'

import type { SecretOf } from './store.js'

// Telegram as your own account (MTProto through GramJS), read-only. Logging in is Telegram's own
// flow: api_id + api_hash from my.telegram.org, a code sent to the app, then the 2FA password if
// there is one. What's kept is the session string. Reading lists dialogs and fetches messages:
// neither marks anything as read.

type Credentials = { apiId: number; apiHash: string }

const newClient = (session: sessions.StringSession, { apiId, apiHash }: Credentials) =>
  new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
    baseLogger: new Logger(LogLevel.ERROR),
  })

/** Telegram's error name ("PHONE_CODE_INVALID"…), when it is one. */
const rpcError = (err: unknown): string | undefined => {
  const m: unknown = typeof err === 'object' && err !== null ? Reflect.get(err, 'errorMessage') : undefined
  return typeof m === 'string' ? m : undefined
}

const READABLE: Record<string, string> = {
  PHONE_NUMBER_INVALID: 'Telegram doesn’t know this phone number (use the international form, +33…)',
  PHONE_CODE_INVALID: 'Wrong code',
  PHONE_CODE_EXPIRED: 'The code expired: start again',
  PASSWORD_HASH_INVALID: 'Wrong password',
  API_ID_INVALID: 'api_id / api_hash are wrong (my.telegram.org → API development tools)',
}
const loginError = (err: unknown) => {
  const name = rpcError(err)
  return httpError(
    400,
    (name && READABLE[name]) ?? `Telegram: ${name ?? (err instanceof Error ? err.message : 'error')}`,
  )
}

type Pending = Credentials & {
  client: TelegramClient
  session: sessions.StringSession
  phone: string
  phoneCodeHash: string
  expires: number
}

export type TelegramLoggedIn = { account: string; secret: SecretOf<'telegram'> }

/** Logins in progress, by id, for 10 minutes. */
export class TelegramLogins {
  private pending = new Map<string, Pending>()

  constructor(private readonly now: () => number = Date.now) {}

  private take(id: string): Pending {
    const p = this.pending.get(id)
    if (!p || p.expires < this.now()) {
      if (p) void p.client.disconnect()
      this.pending.delete(id)
      throw httpError(410, 'This Telegram login expired: start again')
    }
    return p
  }

  async start(creds: Credentials, phone: string): Promise<string> {
    for (const [id, p] of this.pending) if (p.expires < this.now()) this.drop(id)
    const session = new sessions.StringSession('')
    const client = newClient(session, creds)
    try {
      await client.connect()
      const { phoneCodeHash } = await client.sendCode(creds, phone)
      const id = randomUUID()
      this.pending.set(id, { ...creds, client, session, phone, phoneCodeHash, expires: this.now() + 10 * 60_000 })
      return id
    } catch (err) {
      await client.disconnect()
      throw loginError(err)
    }
  }

  /** The code from the Telegram app: logged in, or a 2FA password is needed next. */
  async code(id: string, code: string): Promise<TelegramLoggedIn | 'password'> {
    const p = this.take(id)
    try {
      const r = await p.client.invoke(
        new Api.auth.SignIn({ phoneNumber: p.phone, phoneCodeHash: p.phoneCodeHash, phoneCode: code.trim() }),
      )
      if (r instanceof Api.auth.AuthorizationSignUpRequired) throw httpError(400, 'This number has no Telegram account')
    } catch (err) {
      if (rpcError(err) === 'SESSION_PASSWORD_NEEDED') return 'password'
      if (err instanceof Error && 'status' in err) throw err
      throw loginError(err)
    }
    return this.finish(id, p)
  }

  async password(id: string, password: string): Promise<TelegramLoggedIn> {
    const p = this.take(id)
    let failure: unknown
    try {
      await p.client.signInWithPassword(p, {
        password: async () => password,
        onError: async (err) => {
          failure = err
          return true
        },
      })
    } catch (err) {
      throw loginError(failure ?? err)
    }
    return this.finish(id, p)
  }

  private async finish(id: string, p: Pending): Promise<TelegramLoggedIn> {
    const me = await p.client.getMe()
    const account = me.username ? `@${me.username}` : me.phone ? `+${me.phone}` : p.phone
    const secret = { provider: 'telegram' as const, apiId: p.apiId, apiHash: p.apiHash, session: p.session.save() }
    this.drop(id)
    return { account, secret }
  }

  private drop(id: string): void {
    const p = this.pending.get(id)
    this.pending.delete(id)
    if (p) void p.client.disconnect()
  }
}

/** What one chat needs to become a ChatSummary (taken out of GramJS's dialog, for tests). */
export type TelegramChatRaw = {
  id: string
  name: string
  type: ChatSummary['type']
  username?: string | undefined
  unread: number
  mentions: number
  muted: boolean
  archived: boolean
  /** Seconds since the epoch. */
  date: number
}

/** What one message needs to become a ChatMessage (taken out of GramJS's objects, for tests). */
export type TelegramRaw = {
  id: number
  text: string
  /** Seconds since the epoch. */
  date: number
  from: string
  out: boolean
  mentioned: boolean
}

export function telegramChat(c: Connection, d: TelegramChatRaw): ChatSummary {
  return {
    connection: c.id,
    provider: 'telegram',
    account: c.account,
    id: d.id,
    name: d.name,
    type: d.type,
    unread: d.unread,
    muted: d.muted,
    lastDate: new Date(d.date * 1000).toISOString(),
  }
}

/** Like Telegram's own unread badge: unread chats that aren't muted or archived, plus any that mention you. */
export const countsAsUnread = (d: TelegramChatRaw) => d.unread > 0 && (d.mentions > 0 || (!d.muted && !d.archived))

export function telegramMessage(c: Connection, d: TelegramChatRaw, m: TelegramRaw): ChatMessage {
  const kind: ChatMessage['kind'] = d.type === 'user' || d.type === 'bot' ? 'direct' : m.mentioned ? 'mention' : d.type
  return {
    connection: c.id,
    provider: 'telegram',
    account: c.account,
    chat: d.name,
    from: m.out ? 'me' : m.from,
    text: (m.text || '(media)').slice(0, 2000),
    date: new Date(m.date * 1000).toISOString(),
    kind,
    ...(d.username ? { link: `https://t.me/${d.username}/${m.id}` } : {}),
    ...(d.unread ? { chatUnread: d.unread } : {}),
  }
}

const nameOf = (e: unknown): string => {
  if (e instanceof Api.User) return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.username || 'someone'
  if (e instanceof Api.Chat || e instanceof Api.Channel) return e.title
  return 'someone'
}

function rawChat(d: Dialog, now: number): TelegramChatRaw {
  const settings = d.dialog.notifySettings
  const e = d.entity
  const type: ChatSummary['type'] = d.isUser
    ? e instanceof Api.User && e.bot
      ? 'bot'
      : 'user'
    : d.isGroup
      ? 'group'
      : 'channel'
  return {
    id: d.id?.toString() ?? '',
    name: d.title ?? d.name ?? 'Telegram',
    type,
    username: e && 'username' in e ? (e.username ?? undefined) : undefined,
    unread: d.unreadCount,
    mentions: d.unreadMentionsCount,
    muted: settings instanceof Api.PeerNotifySettings && (settings.muteUntil ?? 0) > now,
    archived: d.archived,
    date: d.date,
  }
}

/** Chats with unread messages at most this many are read, and this many of their latest messages. */
const MAX_CHATS = 30
const PER_CHAT = 10
const DIALOGS = 200

/** One connected client per account, kept between reads. */
export class TelegramReader {
  private clients = new Map<string, Promise<TelegramClient>>()

  private client(c: Connection, secret: SecretOf<'telegram'>): Promise<TelegramClient> {
    let client = this.clients.get(c.id)
    if (!client) {
      const t = newClient(new sessions.StringSession(secret.session), secret)
      client = t.connect().then(() => t)
      client.catch(() => this.clients.delete(c.id))
      this.clients.set(c.id, client)
    }
    return client
  }

  private async dialogs(c: Connection, secret: SecretOf<'telegram'>) {
    const client = await this.client(c, secret)
    if (!(await client.checkAuthorization()))
      throw httpError(401, 'Telegram signed this session out: connect Telegram again')
    const now = Date.now() / 1000
    const dialogs = await client.getDialogs({ limit: DIALOGS })
    return { client, dialogs: dialogs.map((d) => ({ d, raw: rawChat(d, now) })) }
  }

  private async messages(client: TelegramClient, d: Dialog, limit: number): Promise<TelegramRaw[]> {
    const messages = await client.getMessages(d.entity, { limit })
    return messages.map((m) => ({
      id: m.id,
      text: m.message,
      date: m.date,
      from: d.isUser ? (d.title ?? 'someone') : nameOf(m.sender),
      out: Boolean(m.out),
      mentioned: Boolean(m.mentioned),
    }))
  }

  /** The conversations, most recent first (for the AI to find one to read). */
  async chats(c: Connection, secret: SecretOf<'telegram'>): Promise<ChatSummary[]> {
    const { dialogs } = await this.dialogs(c, secret)
    return dialogs.map(({ raw }) => telegramChat(c, raw))
  }

  /** The latest messages of every chat Telegram counts as unread (whatever their age). */
  async unread(c: Connection, secret: SecretOf<'telegram'>): Promise<ChatMessage[]> {
    const { client, dialogs } = await this.dialogs(c, secret)
    const unread = dialogs.filter(({ raw }) => countsAsUnread(raw)).slice(0, MAX_CHATS)
    const out = await Promise.all(
      unread.map(async ({ d, raw }) =>
        (await this.messages(client, d, Math.min(raw.unread, PER_CHAT)))
          .filter((m) => !m.out)
          .map((m) => telegramMessage(c, raw, m)),
      ),
    )
    return out.flat().toSorted((a, b) => b.date.localeCompare(a.date))
  }

  /** The latest messages of one chat (read or not; nothing is marked as read). */
  async read(c: Connection, secret: SecretOf<'telegram'>, chatId: string, limit: number): Promise<ChatMessage[]> {
    const { client, dialogs } = await this.dialogs(c, secret)
    const found = dialogs.find(({ raw }) => raw.id === chatId)
    if (!found) throw notFound(`No Telegram chat ${chatId} among the ${DIALOGS} most recent: use list_chats`)
    return (await this.messages(client, found.d, limit)).map((m) => telegramMessage(c, found.raw, m))
  }

  async forget(id: string): Promise<void> {
    const client = this.clients.get(id)
    this.clients.delete(id)
    if (client) await (await client.catch(() => null))?.disconnect()
  }
}
