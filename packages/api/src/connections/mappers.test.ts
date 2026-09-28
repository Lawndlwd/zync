import type { Connection } from '@zync/jobs'
import { describe, expect, it } from 'vitest'

import { gmailQuery, mailItem, mailText } from './gmail.js'
import { externalEvent } from './google-calendar.js'
import { slackMessage, slackText } from './slack.js'
import { countsAsUnread, telegramChat, telegramMessage } from './telegram.js'

// What the services answer, turned into zync's shapes (no network: the raw answers are made up
// in the services' documented formats).

const c: Connection = { id: 'c1', provider: 'google', label: 'Work', account: 'me@work.com', createdAt: 0 }
const b64 = (s: string) => Buffer.from(s).toString('base64url')

describe('gmail', () => {
  const raw = {
    id: 'm1',
    threadId: 't1',
    labelIds: ['INBOX', 'UNREAD'],
    snippet: 'Can we talk about the offer&#39;s terms?',
    internalDate: String(Date.UTC(2026, 8, 28, 7, 30)),
    payload: {
      headers: [
        { name: 'From', value: 'Sara <sara@acme.com>' },
        { name: 'subject', value: 'Offer' },
      ],
    },
  }

  it('maps a message with a link to its thread in the right account', () => {
    expect(mailItem(c, raw)).toEqual({
      connection: 'c1',
      account: 'me@work.com',
      id: 'm1',
      from: 'Sara <sara@acme.com>',
      subject: 'Offer',
      snippet: "Can we talk about the offer's terms?",
      date: '2026-09-28T07:30:00.000Z',
      unread: true,
      link: 'https://mail.google.com/mail/u/?authuser=me%40work.com#all/t1',
    })
  })

  it('reads the plain text part, else the HTML without tags', () => {
    const plain = {
      parts: [
        { mimeType: 'text/html', body: { data: b64('<b>x</b>') } },
        { mimeType: 'text/plain', body: { data: b64('Hello\n') } },
      ],
    }
    expect(mailText(plain)).toBe('Hello')
    const html = { mimeType: 'text/html', body: { data: b64('<style>a{}</style><p>Hi</p><p>there</p>') } }
    expect(mailText(html)).toBe('Hi\nthere')
  })

  it('searches after a moment, the inbox by default', () => {
    const since = new Date(Date.UTC(2026, 8, 27, 7))
    expect(gmailQuery(since)).toBe(`after:${since.getTime() / 1000} in:inbox`)
    expect(gmailQuery(since, 'is:unread')).toBe(`after:${since.getTime() / 1000} is:unread`)
  })
})

describe('google calendar', () => {
  const base = { id: 'e1', summary: 'Standup', htmlLink: 'https://calendar.google.com/e1' }

  it('keeps the local wall clock of timed events', () => {
    const e = externalEvent(c, {
      ...base,
      start: { dateTime: '2026-09-28T09:30:00+02:00' },
      end: { dateTime: '2026-09-28T10:00:00+02:00' },
    })
    expect(e).toMatchObject({ start: '2026-09-28T09:30', end: '2026-09-28T10:00', allDay: false, title: 'Standup' })
  })

  it("turns Google's exclusive all-day end into the last day, and skips cancelled events", () => {
    expect(externalEvent(c, { ...base, start: { date: '2026-09-28' }, end: { date: '2026-09-30' } })).toMatchObject({
      start: '2026-09-28',
      end: '2026-09-29',
      allDay: true,
    })
    expect(externalEvent(c, { ...base, status: 'cancelled', start: { date: '2026-09-28' }, end: {} })).toBeNull()
  })
})

describe('slack', () => {
  const secret = {
    provider: 'slack' as const,
    token: 'xoxp-1',
    userId: 'U1',
    teamId: 'T1',
    url: 'https://acme.slack.com/',
  }
  const names = new Map([['U2', 'Tom']])

  it('makes mentions and links readable', () => {
    expect(slackText('<@U2> see <https://x.io|the doc> <!here>', names)).toBe('@Tom see the doc @here')
  })

  it('links a message to its place in Slack', () => {
    const m = slackMessage(
      { ...c, provider: 'slack', account: 'acme' },
      secret,
      { ts: '1727510400.000100', user: 'U2', text: 'hi' },
      { channel: 'D1', chat: 'Tom', kind: 'direct' },
      names,
    )
    expect(m).toMatchObject({
      from: 'Tom',
      chat: 'Tom',
      kind: 'direct',
      link: 'https://acme.slack.com/archives/D1/p1727510400000100',
    })
  })
})

describe('telegram', () => {
  const chat = {
    id: '-100123',
    name: 'Dev news',
    type: 'channel' as const,
    unread: 140,
    mentions: 0,
    muted: false,
    archived: false,
    date: 1727510400,
  }
  const msg = { id: 42, text: '', date: 1727510400, from: 'Dev news', out: false, mentioned: false }

  it('counts unread chats like Telegram’s badge: channels and bots too, not muted or archived ones', () => {
    expect(countsAsUnread(chat)).toBe(true)
    expect(countsAsUnread({ ...chat, type: 'bot', unread: 5 })).toBe(true)
    expect(countsAsUnread({ ...chat, muted: true })).toBe(false)
    expect(countsAsUnread({ ...chat, archived: true })).toBe(false)
    expect(countsAsUnread({ ...chat, muted: true, mentions: 1 })).toBe(true)
    expect(countsAsUnread({ ...chat, unread: 0 })).toBe(false)
  })

  it('says where a message was and how much is unread there, linking public chats only', () => {
    expect(telegramMessage(c, { ...chat, username: 'devnews' }, msg)).toMatchObject({
      kind: 'channel',
      text: '(media)',
      chatUnread: 140,
      link: 'https://t.me/devnews/42',
      date: '2024-09-28T08:00:00.000Z',
    })
    expect(telegramMessage(c, chat, msg).link).toBeUndefined()
    expect(telegramMessage(c, { ...chat, type: 'bot' }, msg).kind).toBe('direct')
    expect(telegramMessage(c, { ...chat, type: 'group' }, { ...msg, mentioned: true }).kind).toBe('mention')
    expect(telegramMessage(c, chat, { ...msg, out: true }).from).toBe('me')
  })

  it('summarises a chat for list_chats', () => {
    expect(telegramChat(c, chat)).toMatchObject({ id: '-100123', type: 'channel', unread: 140, muted: false })
  })
})
