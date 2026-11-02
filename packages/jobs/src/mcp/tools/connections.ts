import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { internalGet } from '../../connections/index.js'
import { safe } from '../format.js'

// Read-only access to the accounts connected in Settings → Connections (Google, Slack, Telegram).
// There is no tool to send, reply, archive or mark as read: zync only reads these services.

const sinceArg = z
  .string()
  .describe(
    'Only what arrived after this moment, ISO date-time, e.g. "2026-09-27T07:00:00Z" (default: the last 24 hours).',
  )
const connectionArg = z
  .string()
  .optional()
  .describe('One connection id from list_connections (default: every connected account of that kind).')

export function registerConnectionTools(server: McpServer): void {
  server.registerTool(
    'list_connections',
    {
      description:
        'The accounts the user connected in Settings → Connections: Google accounts (Gmail + Calendar), Slack workspaces, Telegram. ' +
        'Each has an id, a provider, a label (the user\'s name for it, e.g. "Work") and the account (email, team, phone). ' +
        "A connection with an error can't be read until the user reconnects it.",
      inputSchema: {},
    },
    safe(async () => internalGet('/connections')),
  )

  server.registerTool(
    'search_mail',
    {
      description:
        'Mail from the connected Google accounts, newest first: sender, subject, snippet, unread flag and a link. ' +
        'Without a query: the inbox since `since`. The answer lists accounts that could not be read under `failed`.',
      inputSchema: {
        since: sinceArg.optional(),
        query: z
          .string()
          .optional()
          .describe('Gmail search, e.g. "is:unread", "from:sara@acme.com", "is:important". Combined with since.'),
        connection: connectionArg,
        limit: z.number().int().min(1).max(50).optional().describe('Per account (default 20).'),
      },
    },
    safe(async ({ since, query, connection, limit }) =>
      internalGet('/mail', { since, query, connection, limit: limit?.toString() }),
    ),
  )

  server.registerTool(
    'read_mail',
    {
      description: "One mail in full (plain text body), from search_mail's connection and id.",
      inputSchema: { connection: z.string(), id: z.string() },
    },
    safe(async ({ connection, id }) =>
      internalGet(`/mail/${encodeURIComponent(connection)}/${encodeURIComponent(id)}`),
    ),
  )

  server.registerTool(
    'external_events',
    {
      description:
        'Events of the connected Google calendars between two days (the primary calendar of each account). ' +
        'zync\'s own calendar (list_calendar) is separate: look at both for "my meetings today".',
      inputSchema: {
        from: z.string().describe('First day, "YYYY-MM-DD".'),
        to: z.string().describe('Day after the last day, "YYYY-MM-DD" (exclusive).'),
      },
    },
    safe(async ({ from, to }) => internalGet('/events', { from, to })),
  )

  server.registerTool(
    'unread_messages',
    {
      description:
        'Unread Slack and Telegram messages. Telegram: every chat its unread badge counts (people, bots, groups, ' +
        'channels; not muted or archived chats unless they mention the user), whatever their age, with the latest ' +
        'messages of each and `chatUnread` (how many are unread there). Slack: direct and group messages since ' +
        '`since`, and mentions. Nothing is marked as read. To read a chat in full, use list_chats and read_chat.',
      inputSchema: {
        since: sinceArg.optional(),
        provider: z.enum(['slack', 'telegram']).optional().describe('Only one of them (default: both).'),
        connection: connectionArg,
      },
    },
    safe(async ({ since, provider, connection }) => internalGet('/messages', { since, provider, connection })),
  )

  server.registerTool(
    'list_chats',
    {
      description:
        'Telegram conversations, most recent first: id, name, type (user, bot, group, channel), unread count, muted. ' +
        'Use it to find a chat the user names ("what did Ana say?", "read the Dev group"), then read_chat.',
      inputSchema: { connection: connectionArg },
    },
    safe(async ({ connection }) => internalGet('/chats', { connection })),
  )

  server.registerTool(
    'read_chat',
    {
      description:
        'The latest messages of one Telegram chat (from list_chats), read or not, newest first; "me" marks the ' +
        "user's own messages. Nothing is marked as read.",
      inputSchema: {
        connection: z.string().describe('The connection id, from list_chats.'),
        chat: z.string().describe('The chat id, from list_chats.'),
        limit: z.number().int().min(1).max(100).optional().describe('How many messages (default 20).'),
      },
    },
    safe(async ({ connection, chat, limit }) =>
      internalGet(`/chats/${encodeURIComponent(connection)}/${encodeURIComponent(chat)}`, { limit: limit?.toString() }),
    ),
  )
}
