// Accounts connected in Settings → Connections (read-only). Mirrors @zync/jobs connections/types.

export type Provider = 'google' | 'slack' | 'telegram'

export type Connection = {
  id: string
  provider: Provider
  /** Your name for it ("Work"); the account by default. */
  label: string
  /** Email, Slack team, or Telegram @name / phone. */
  account: string
  createdAt: number
  /** The last read failed (expired token…): reconnect. */
  error?: string
}

export type ConnectionList = {
  connections: Connection[]
  /** Providers this server can connect (Google needs its OAuth client configured). */
  available: Record<Provider, boolean>
}

export type ExternalEvent = {
  connection: string
  account: string
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location?: string
  link: string
}

export type Gathered<T> = { items: T[]; failed: Array<{ connection: string; account: string; error: string }> }
