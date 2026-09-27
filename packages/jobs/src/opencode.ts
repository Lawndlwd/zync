// Raw HTTP client for the opencode server. The SDK proved unreliable in the past
// (empty prompt responses, model inheritance bugs), so we call the API directly.

import { z } from 'zod'

import { sleep } from './helpers/async.js'
import { parseJson } from './helpers/json.js'

// Only the fields we read; everything else opencode sends is kept but ignored.
const SessionSchema = z.looseObject({ id: z.string() })
const MessageSchema = z.looseObject({
  info: z.looseObject({
    role: z.string().optional(),
    error: z.unknown().optional(),
    finish: z.string().optional(),
    time: z.looseObject({ completed: z.number().optional() }).optional(),
  }),
  parts: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).optional(),
})
const HealthSchema = z.looseObject({ healthy: z.boolean(), version: z.string().optional() })
const ErrorSchema = z.looseObject({
  name: z.string().optional(),
  message: z.string().optional(),
  data: z.looseObject({ message: z.string().optional() }).optional(),
})

const EventSchema = z.looseObject({
  directory: z.string().optional(),
  payload: z
    .looseObject({
      type: z.string().optional(),
      properties: z.looseObject({ sessionID: z.string().optional() }).optional(),
    })
    .optional(),
})
/** One message of the global event stream: `{ directory, payload: { type, properties } }`. */
export type OpencodeEvent = z.infer<typeof EventSchema>

export type OpencodeOptions = {
  baseUrl?: string
  password?: string
  username?: string
}

export type SessionResult = {
  done: boolean
  failed: boolean
  text: string
  error?: string
}

export class OpencodeClient {
  readonly baseUrl: string
  private readonly authHeader?: string

  constructor(opts: OpencodeOptions = {}) {
    this.baseUrl = (opts.baseUrl || process.env.OPENCODE_URL || 'http://127.0.0.1:4096').replace(/\/$/, '')
    const password = opts.password ?? process.env.OPENCODE_SERVER_PASSWORD
    if (password) {
      const user = opts.username ?? process.env.OPENCODE_SERVER_USERNAME ?? 'opencode'
      this.authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
    }
  }

  private async call(path: string, directory: string | undefined, init: RequestInit = {}): Promise<unknown> {
    const url = new URL(this.baseUrl + path)
    if (directory) url.searchParams.set('directory', directory)
    const res = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(this.authHeader ? { authorization: this.authHeader } : {}),
        ...Object.fromEntries(new Headers(init.headers)),
      },
    })
    if (res.status === 204) return null
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`opencode ${init.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`)
    }
    const ct = res.headers.get('content-type') || ''
    return ct.includes('application/json') ? res.json() : res.text()
  }

  async createSession(directory: string, title: string, agent?: string): Promise<string> {
    const session = SessionSchema.safeParse(
      await this.call('/session', directory, {
        method: 'POST',
        body: JSON.stringify({ title, ...(agent ? { agent } : {}) }),
      }),
    )
    if (!session.success || !session.data.id) throw new Error('opencode did not return a session id')
    return session.data.id
  }

  async promptAsync(
    sessionId: string,
    directory: string,
    text: string,
    opts: { agent?: string; model?: string } = {},
  ): Promise<void> {
    const body: Record<string, unknown> = { parts: [{ type: 'text', text }] }
    if (opts.agent) body.agent = opts.agent
    if (opts.model) {
      const i = opts.model.indexOf('/')
      body.model = { providerID: opts.model.slice(0, i), modelID: opts.model.slice(i + 1) }
    }
    await this.call(`/session/${sessionId}/prompt_async`, directory, { method: 'POST', body: JSON.stringify(body) })
  }

  async abort(sessionId: string, directory: string): Promise<void> {
    await this.call(`/session/${sessionId}/abort`, directory, { method: 'POST' }).catch(() => {})
  }

  /** Inspect the last assistant message to decide whether the run finished. */
  async sessionResult(sessionId: string, directory: string): Promise<SessionResult> {
    const msgs = z.array(MessageSchema).safeParse(await this.call(`/session/${sessionId}/message`, directory))
    const last = (msgs.success ? msgs.data : []).findLast((m) => m.info.role === 'assistant')
    if (!last) return { done: false, failed: false, text: '' }
    const { info } = last
    const text = (last.parts ?? [])
      .flatMap((p) => (p.type === 'text' && p.text ? [p.text] : []))
      .join('\n')
      .trim()
    const error = info.error ? describeError(info.error) : undefined
    // A message that ended on tool calls means the agent loop continues with another message.
    const completed = Boolean(info.time?.completed) && info.finish !== 'tool-calls'
    return { done: completed || Boolean(error), failed: Boolean(error), text, error }
  }

  /** Server health and version, or null when unreachable. */
  async healthInfo(): Promise<{ healthy: boolean; version?: string } | null> {
    try {
      const health = HealthSchema.safeParse(await this.call('/global/health', undefined))
      return health.success ? health.data : null
    } catch {
      return null
    }
  }

  /**
   * Subscribe to the global event stream. Reconnects forever; returns a stop function.
   * `onEvent` receives `{ directory, payload: { type, properties } }`.
   */
  subscribe(onEvent: (event: OpencodeEvent) => void, onStatus?: (connected: boolean) => void): () => void {
    // Aborting it ends the loop and cancels the open stream.
    const stop = new AbortController()
    const stopped = () => stop.signal.aborted

    const run = async () => {
      while (!stopped()) {
        try {
          const res = await fetch(`${this.baseUrl}/global/event`, {
            headers: { accept: 'text/event-stream', ...(this.authHeader ? { authorization: this.authHeader } : {}) },
            signal: stop.signal,
          })
          if (!res.ok || !res.body) throw new Error(`event stream → ${res.status}`)
          onStatus?.(true)
          const decoder = new TextDecoder()
          let buf = ''
          for await (const chunk of res.body) {
            buf += decoder.decode(chunk, { stream: true })
            let idx: number
            while ((idx = buf.indexOf('\n\n')) >= 0) {
              const block = buf.slice(0, idx)
              buf = buf.slice(idx + 2)
              const data = block
                .split('\n')
                .filter((l) => l.startsWith('data:'))
                .map((l) => l.slice(5).trimStart())
                .join('\n')
              if (!data) continue
              const event = EventSchema.safeParse(parseJson(data))
              if (event.success) onEvent(event.data)
            }
          }
        } catch {
          // fall through to reconnect
        }
        onStatus?.(false)
        if (!stopped()) await sleep(3000)
      }
    }
    void run()
    return () => {
      stop.abort()
    }
  }
}

function describeError(err: unknown): string {
  const e = ErrorSchema.safeParse(err)
  return (e.success && (e.data.data?.message || e.data.message || e.data.name)) || JSON.stringify(err)
}
