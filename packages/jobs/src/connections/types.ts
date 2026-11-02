// Outside services zync reads from (never writes to): Google accounts (Gmail + Calendar), Slack and
// Telegram. The api keeps the login secrets in a folder only it can read; the MCP tools and the web
// app only ever see these shapes. Nothing here is stored in a workspace: every read is live.

export const PROVIDERS = ['google', 'slack', 'telegram'] as const
export type Provider = (typeof PROVIDERS)[number]

/** One connected account. `id` is random; `account` is what the service calls it (email, team, phone). */
export type Connection = {
  id: string
  provider: Provider
  /** Your own name for it ("Work", "Perso"); defaults to `account`. */
  label: string
  account: string
  createdAt: number
  /** Last read that failed (expired token, revoked access), shown in Settings until a read works again. */
  error?: string
}

export type MailItem = {
  connection: string
  /** The account it came from, e.g. "me@work.com". */
  account: string
  id: string
  from: string
  subject: string
  snippet: string
  /** ISO date-time. */
  date: string
  unread: boolean
  link: string
}

export type MailMessage = MailItem & { to: string; body: string }

export type ExternalEvent = {
  connection: string
  account: string
  id: string
  title: string
  /** "YYYY-MM-DD" (all-day) or local "YYYY-MM-DDTHH:MM", like zync's own events. */
  start: string
  /** Inclusive last day when all-day, else the end time. */
  end: string
  allDay: boolean
  location?: string
  link: string
}

export type ChatMessage = {
  connection: string
  provider: 'slack' | 'telegram'
  account: string
  /** Conversation name: a person, a group or a channel. */
  chat: string
  from: string
  text: string
  /** ISO date-time. */
  date: string
  /** Where it was: a direct message (a person or a bot), a mention, a group, or a broadcast channel. */
  kind: 'direct' | 'mention' | 'group' | 'channel'
  link?: string
  /** How many messages of this chat are still unread (only the latest ones are returned). */
  chatUnread?: number
}

/** A conversation of a connected account (Telegram), with what's unread in it. */
export type ChatSummary = {
  connection: string
  provider: 'telegram'
  account: string
  /** Pass to read_chat. */
  id: string
  name: string
  type: 'user' | 'bot' | 'group' | 'channel'
  unread: number
  /** Muted chats don't count in Telegram's unread badge. */
  muted: boolean
  /** ISO date-time of the last message. */
  lastDate: string
}

/** A read across several accounts: what it found, and the accounts it couldn't read. */
export type Gathered<T> = { items: T[]; failed: Array<{ connection: string; account: string; error: string }> }
