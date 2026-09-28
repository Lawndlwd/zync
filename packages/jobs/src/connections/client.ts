import { httpError } from '../errors.js'
import { parseJson } from '../helpers/json.js'

// How the MCP tools read connected accounts: through the api's internal port, which holds the login
// secrets. This process (inside opencode, next to the AI) never sees a token of Google, Slack or
// Telegram, only what the api chooses to answer.

/** Defaults to the api of `pnpm dev` on this machine. */
const baseUrl = () => (process.env.ZYNC_API_INTERNAL_URL || 'http://127.0.0.1:3002').replace(/\/$/, '')

/** GET an internal route; the answer is passed on to the AI as-is. */
export async function internalGet(route: string, query: Record<string, string | undefined> = {}): Promise<unknown> {
  const token = process.env.ZYNC_INTERNAL_TOKEN
  if (!token) throw httpError(503, 'Connections are not set up: ZYNC_INTERNAL_TOKEN is missing on the AI server')
  const params = new URLSearchParams(Object.entries(query).flatMap(([k, v]) => (v ? [[k, v]] : [])))
  const qs = params.size ? `?${params}` : ''
  const res = await fetch(`${baseUrl()}/internal${route}${qs}`, { headers: { Authorization: `Bearer ${token}` } })
  const body = parseJson(await res.text())
  if (!res.ok) {
    const error = typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : undefined
    throw httpError(res.status, typeof error === 'string' ? error : `zync api answered ${res.status}`)
  }
  return body
}
