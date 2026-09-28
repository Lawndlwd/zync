import type { Connection, MailItem, MailMessage } from '@zync/jobs'
import { z } from 'zod'

import { fetchJson } from './http.js'

// Gmail, read-only (gmail.readonly): list and read. Nothing is marked as read.

const API = 'https://gmail.googleapis.com/gmail/v1/users/me'

const HeaderSchema = z.object({ name: z.string(), value: z.string() })
type Part = {
  mimeType?: string | undefined
  body?: { data?: string | undefined } | undefined
  parts?: Part[] | undefined
}
const PartSchema: z.ZodType<Part> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(PartSchema).optional(),
  }),
)
const MessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).default([]),
  snippet: z.string().default(''),
  internalDate: z.string(),
  payload: z.object({ headers: z.array(HeaderSchema).default([]) }).and(PartSchema),
})
export type GmailMessage = z.infer<typeof MessageSchema>
const ListSchema = z.object({ messages: z.array(z.object({ id: z.string() })).default([]) })

const header = (m: GmailMessage, name: string) =>
  m.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

/** Gmail escapes the snippet as HTML. */
const unescape = (s: string) =>
  s
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')

export function mailItem(c: Connection, m: GmailMessage): MailItem {
  return {
    connection: c.id,
    account: c.account,
    id: m.id,
    from: header(m, 'From'),
    subject: header(m, 'Subject') || '(no subject)',
    snippet: unescape(m.snippet),
    date: new Date(Number(m.internalDate)).toISOString(),
    unread: m.labelIds.includes('UNREAD'),
    link: `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(c.account)}#all/${m.threadId}`,
  }
}

const decode = (data: string) => Buffer.from(data, 'base64url').toString('utf8')

/** The readable text of a message: its text/plain part, else its HTML without tags. */
export function mailText(part: Part): string {
  const find = (p: Part, type: string): string | undefined => {
    if (p.mimeType === type && p.body?.data) return decode(p.body.data)
    for (const child of p.parts ?? []) {
      const found = find(child, type)
      if (found !== undefined) return found
    }
    return undefined
  }
  const plain = find(part, 'text/plain')
  if (plain !== undefined) return plain.trim()
  const html = find(part, 'text/html') ?? ''
  return html
    .replaceAll(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replaceAll(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}

/** Gmail's query for "arrived after": whole seconds since the epoch. */
export const gmailQuery = (since: Date, query?: string) =>
  [`after:${Math.floor(since.getTime() / 1000)}`, query?.trim() || 'in:inbox'].join(' ')

export async function listMail(
  c: Connection,
  token: string,
  opts: { since: Date; query?: string | undefined; limit: number },
): Promise<MailItem[]> {
  const q = new URLSearchParams({ q: gmailQuery(opts.since, opts.query), maxResults: String(opts.limit) })
  const list = await fetchJson(`${API}/messages?${q}`, ListSchema, { token })
  const meta = new URLSearchParams([
    ['format', 'metadata'],
    ['metadataHeaders', 'From'],
    ['metadataHeaders', 'Subject'],
  ])
  const messages = await Promise.all(
    list.messages.map((m) => fetchJson(`${API}/messages/${m.id}?${meta}`, MessageSchema, { token })),
  )
  return messages.map((m) => mailItem(c, m))
}

export async function readMail(c: Connection, token: string, id: string): Promise<MailMessage> {
  const m = await fetchJson(`${API}/messages/${encodeURIComponent(id)}?format=full`, MessageSchema, { token })
  return { ...mailItem(c, m), to: header(m, 'To'), body: mailText(m.payload).slice(0, 20_000) }
}
