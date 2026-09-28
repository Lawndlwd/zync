import { type ChatMessage, type Connection, httpError } from '@zync/jobs'
import { z } from 'zod'

import { fetchJson } from './http.js'
import type { SecretOf } from './store.js'

// Slack with your own user token (xoxp-…), read-only: direct and group messages since a moment,
// and mentions of you anywhere. Slack answers 200 with `ok: false` on errors, hence `slackCall`.

const API = 'https://slack.com/api'

const Ok = z.object({ ok: z.boolean(), error: z.string().optional() })

async function slackCall<S extends z.ZodObject>(
  method: string,
  token: string,
  params: Record<string, string>,
  schema: S,
): Promise<z.infer<S>> {
  const body = await fetchJson(`${API}/${method}?${new URLSearchParams(params)}`, Ok.and(schema), { token })
  if (!body.ok) throw httpError(502, `Slack ${method}: ${body.error ?? 'error'}`)
  return body
}

const AuthSchema = z.object({ url: z.string(), team: z.string(), user_id: z.string(), team_id: z.string() })

/** Check a pasted token and find out whose it is. */
export async function slackIdentify(token: string): Promise<{ account: string; secret: SecretOf<'slack'> }> {
  if (!token.startsWith('xoxp-')) throw httpError(400, 'Paste a Slack user token: it starts with xoxp-')
  const me = await slackCall('auth.test', token, {}, AuthSchema)
  return {
    account: me.team,
    secret: { provider: 'slack', token, userId: me.user_id, teamId: me.team_id, url: me.url },
  }
}

const RawMessage = z.object({ ts: z.string(), user: z.string().optional(), text: z.string().default('') })
export type SlackRaw = z.infer<typeof RawMessage>

/** Slack's "1727510400.123456" → ISO date-time. */
const tsDate = (ts: string) => new Date(Number(ts) * 1000).toISOString()

/** Mentions look like <@U123>, links like <https://…|label>: readable text for both. */
export function slackText(text: string, names: Map<string, string>): string {
  return text
    .replaceAll(/<@([A-Z0-9]+)>/g, (_, id: string) => `@${names.get(id) ?? id}`)
    .replaceAll(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replaceAll(/<(https?:[^>]+)>/g, '$1')
    .replaceAll(/<!(here|channel|everyone)>/g, '@$1')
    .trim()
}

export function slackMessage(
  c: Connection,
  secret: SecretOf<'slack'>,
  m: SlackRaw,
  where: { channel: string; chat: string; kind: ChatMessage['kind']; permalink?: string | undefined },
  names: Map<string, string>,
): ChatMessage {
  return {
    connection: c.id,
    provider: 'slack',
    account: c.account,
    chat: where.chat,
    from: m.user ? (names.get(m.user) ?? m.user) : 'Slack',
    text: slackText(m.text, names).slice(0, 2000),
    date: tsDate(m.ts),
    kind: where.kind,
    link: where.permalink ?? `${secret.url.replace(/\/$/, '')}/archives/${where.channel}/p${m.ts.replace('.', '')}`,
  }
}

const Conversation = z.object({
  id: z.string(),
  is_im: z.boolean().optional(),
  user: z.string().optional(),
  name: z.string().optional(),
  updated: z.number().optional(),
})
const UserSchema = z.object({
  user: z.object({
    name: z.string(),
    real_name: z.string().optional(),
    profile: z.object({ display_name: z.string().optional() }).optional(),
  }),
})
const SearchSchema = z.object({
  messages: z.object({
    matches: z
      .array(
        RawMessage.extend({
          permalink: z.string().optional(),
          channel: z.object({ id: z.string(), name: z.string().optional() }),
        }),
      )
      .default([]),
  }),
})

/** Direct and group conversations with the newest activity first; at most this many are read. */
const MAX_CONVERSATIONS = 40

export async function slackUnread(c: Connection, secret: SecretOf<'slack'>, since: Date): Promise<ChatMessage[]> {
  const { token } = secret
  const names = new Map<string, string>()
  const nameOf = async (id: string) => {
    if (!names.has(id)) {
      const u = await slackCall('users.info', token, { user: id }, UserSchema).catch(() => null)
      names.set(id, u ? u.user.profile?.display_name || u.user.real_name || u.user.name : id)
    }
    return names.get(id) ?? id
  }

  const list = await slackCall(
    'conversations.list',
    token,
    { types: 'im,mpim', exclude_archived: 'true', limit: '200' },
    z.object({ channels: z.array(Conversation).default([]) }),
  )
  const oldest = String(since.getTime() / 1000)
  const recent = list.channels
    .filter((ch) => ch.updated === undefined || ch.updated >= since.getTime())
    .toSorted((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
    .slice(0, MAX_CONVERSATIONS)
  const history = await Promise.all(
    recent.map(async (ch) => {
      const h = await slackCall(
        'conversations.history',
        token,
        { channel: ch.id, oldest, limit: '20' },
        z.object({ messages: z.array(RawMessage).default([]) }),
      )
      const theirs = h.messages.filter((m) => m.user && m.user !== secret.userId)
      if (!theirs.length) return []
      const chat = ch.is_im && ch.user ? await nameOf(ch.user) : (ch.name ?? 'group')
      for (const m of theirs) if (m.user) await nameOf(m.user)
      const kind = ch.is_im ? ('direct' as const) : ('group' as const)
      return theirs.map((m) => ({
        key: `${ch.id}:${m.ts}`,
        message: slackMessage(c, secret, m, { channel: ch.id, chat, kind }, names),
      }))
    }),
  )

  const day = since.toISOString().slice(0, 10)
  const search = await slackCall(
    'search.messages',
    token,
    { query: `<@${secret.userId}> after:${day}`, count: '30', sort: 'timestamp' },
    SearchSchema,
  )
  // A mention inside a conversation already read above is listed once, from there.
  const seen = new Set(history.flat().map((h) => h.key))
  const mentions = await Promise.all(
    search.messages.matches
      .filter(
        (m) =>
          Number(m.ts) * 1000 >= since.getTime() && m.user !== secret.userId && !seen.has(`${m.channel.id}:${m.ts}`),
      )
      .map(async (m) => {
        if (m.user) await nameOf(m.user)
        const mentioned = [...m.text.matchAll(/<@([A-Z0-9]+)>/g)].flatMap(([, id]) => (id ? [id] : []))
        await Promise.all(mentioned.map(nameOf))
        const chat = m.channel.name ? `#${m.channel.name}` : 'Slack'
        return slackMessage(
          c,
          secret,
          m,
          { channel: m.channel.id, chat, kind: 'mention', permalink: m.permalink },
          names,
        )
      }),
  )

  return [...history.flat().map((h) => h.message), ...mentions].toSorted((a, b) => b.date.localeCompare(a.date))
}
