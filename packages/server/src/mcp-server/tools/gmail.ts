import { z } from 'zod'
import { getDb } from '../../bot/memory/db.js'
import { getGmailClient } from './google-auth.js'

function decodeBody(payload: any): string {
  if (payload?.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }
  if (payload?.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain')
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, 'base64url').toString('utf-8')
    }
  }
  return ''
}

function markProcessed(messageId: string, action: string): void {
  const db = getDb()
  db.prepare(
    `INSERT OR IGNORE INTO processed_emails (message_id, action) VALUES (?, ?)`
  ).run(messageId, action)
}

function isProcessed(messageId: string): boolean {
  const db = getDb()
  const row = db.prepare('SELECT 1 FROM processed_emails WHERE message_id = ?').get(messageId)
  return !!row
}

// --- gmail_get_unread ---

export const gmailGetUnreadSchema = z.object({
  days: z.number().default(7).describe('Number of days to look back (default 7)'),
  mark_processed: z.boolean().default(false).describe('Mark fetched emails as processed to avoid re-processing'),
})

export async function gmailGetUnread(input: z.infer<typeof gmailGetUnreadSchema>): Promise<string> {
  const gmail = getGmailClient()
  const after = Math.floor((Date.now() - input.days * 86400_000) / 1000)

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `is:unread after:${after}`,
    maxResults: 50,
  })

  const messageIds = listRes.data.messages || []
  if (messageIds.length === 0) {
    return JSON.stringify({ count: 0, emails: [] })
  }

  const emails = await Promise.all(
    messageIds.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })
      const headers = msg.data.payload?.headers || []
      const from = headers.find(h => h.name === 'From')?.value || 'unknown'
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)'
      const date = headers.find(h => h.name === 'Date')?.value || ''

      if (input.mark_processed && msg.data.id) {
        markProcessed(msg.data.id, 'briefed')
      }

      return {
        id: msg.data.id,
        threadId: msg.data.threadId,
        from,
        subject,
        snippet: msg.data.snippet || '',
        date: date ? new Date(date).toISOString() : new Date(Number(msg.data.internalDate)).toISOString(),
        alreadyProcessed: msg.data.id ? isProcessed(msg.data.id) : false,
      }
    })
  )

  return JSON.stringify({ count: emails.length, emails })
}

// --- gmail_get_thread ---

export const gmailGetThreadSchema = z.object({
  thread_id: z.string().describe('Gmail thread ID to fetch'),
})

export async function gmailGetThread(input: z.infer<typeof gmailGetThreadSchema>): Promise<string> {
  const gmail = getGmailClient()

  const thread = await gmail.users.threads.get({
    userId: 'me',
    id: input.thread_id,
    format: 'full',
  })

  const messages = (thread.data.messages || []).map((msg) => {
    const headers = msg.payload?.headers || []
    const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || 'unknown'
    const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || ''
    const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(no subject)'
    const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || ''
    const messageId = headers.find(h => h.name?.toLowerCase() === 'message-id')?.value || ''

    return {
      id: msg.id,
      from,
      to,
      subject,
      body: decodeBody(msg.payload),
      date: date ? new Date(date).toISOString() : new Date(Number(msg.internalDate)).toISOString(),
      messageId,
    }
  })

  return JSON.stringify({ threadId: thread.data.id, messages })
}

// --- gmail_send_reply ---

export const gmailSendReplySchema = z.object({
  thread_id: z.string().describe('Gmail thread ID to reply to'),
  to: z.string().describe('Recipient email address'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Reply body text'),
  message_id: z.string().optional().describe('Message-ID header for threading'),
})

export async function gmailSendReply(input: z.infer<typeof gmailSendReplySchema>): Promise<string> {
  const gmail = getGmailClient()

  const headers = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset=utf-8',
  ]
  if (input.message_id) {
    headers.push(`In-Reply-To: ${input.message_id}`)
    headers.push(`References: ${input.message_id}`)
  }

  const raw = [...headers, '', input.body].join('\n')
  const encoded = Buffer.from(raw).toString('base64url')

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded, threadId: input.thread_id },
  })

  return JSON.stringify({ success: true, messageId: result.data.id })
}

// --- gmail_compose ---

export const gmailComposeSchema = z.object({
  to: z.string().describe('Recipient email address'),
  subject: z.string().describe('Email subject line'),
  body: z.string().describe('Email body text'),
})

export async function gmailCompose(input: z.infer<typeof gmailComposeSchema>): Promise<string> {
  const gmail = getGmailClient()

  const raw = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    input.body,
  ].join('\n')

  const encoded = Buffer.from(raw).toString('base64url')

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  })

  return JSON.stringify({ success: true, messageId: result.data.id })
}

// --- gmail_search ---

export const gmailSearchSchema = z.object({
  query: z.string().describe('Gmail search query (uses Gmail search syntax, e.g. "from:john subject:meeting")'),
  max_results: z.number().default(20).describe('Maximum number of results (default 20)'),
})

export async function gmailSearch(input: z.infer<typeof gmailSearchSchema>): Promise<string> {
  const gmail = getGmailClient()

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: input.query,
    maxResults: input.max_results,
  })

  const messageIds = listRes.data.messages || []
  if (messageIds.length === 0) {
    return JSON.stringify({ count: 0, emails: [] })
  }

  const emails = await Promise.all(
    messageIds.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: m.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })
      const headers = msg.data.payload?.headers || []
      const from = headers.find(h => h.name === 'From')?.value || 'unknown'
      const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)'
      const date = headers.find(h => h.name === 'Date')?.value || ''
      const isUnread = (msg.data.labelIds || []).includes('UNREAD')

      return {
        id: msg.data.id,
        threadId: msg.data.threadId,
        from,
        subject,
        snippet: msg.data.snippet || '',
        date: date ? new Date(date).toISOString() : new Date(Number(msg.data.internalDate)).toISOString(),
        isUnread,
      }
    })
  )

  return JSON.stringify({ count: emails.length, emails })
}
