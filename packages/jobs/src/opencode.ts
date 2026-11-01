// Raw HTTP client for the opencode v2 server (`/api/*`). The SDK proved unreliable in the past
// (empty prompt responses, model inheritance bugs), so we call the API directly.

import { z } from 'zod'

import { sleep } from './helpers/async.js'
import { parseJson } from './helpers/json.js'

// Only the fields we read; everything else opencode sends is kept but ignored.
const ErrorSchema = z.looseObject({ type: z.string().optional(), message: z.string().optional() })
const SessionSchema = z.looseObject({ data: z.looseObject({ id: z.string() }) })
const MessageSchema = z.looseObject({
  type: z.string(),
  outcome: z.string().optional(),
  error: ErrorSchema.optional(),
  content: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).optional(),
})
const MessagesSchema = z.looseObject({ data: z.array(MessageSchema) })
const InfoSchema = z.looseObject({ version: z.string().optional() })

const RawEventSchema = z.looseObject({
  type: z.string().optional(),
  location: z.looseObject({ directory: z.string().optional() }).optional(),
  data: z.looseObject({ sessionID: z.string().optional() }).optional(),
})
/** One message of the event stream, flattened to what zync reads. */
export type OpencodeEvent = { type?: string; sessionID?: string; directory?: string }

export type OpencodeOptions = {
  baseUrl?: string
  password?: string
}

export type SessionResult = {
  done: boolean
  failed: boolean
  text: string
  error?: string
}

/** HTTP Basic credentials for the opencode server: the user is always "opencode" (v2). */
export function opencodeAuthHeader(
  password = process.env.OPENCODE_PASSWORD || process.env.OPENCODE_SERVER_PASSWORD,
): string | undefined {
  return password ? `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}` : undefined
}

/** "provider/model" as opencode's model reference. */
function modelRef(model: string): { providerID: string; id: string } {
  const i = model.indexOf('/')
  return { providerID: model.slice(0, i), id: model.slice(i + 1) }
}

const describeError = (err: z.infer<typeof ErrorSchema>) => err.message || err.type || 'unknown error'

/** Outcome of a run from its messages, newest first. A run is over once opencode logged it idle. */
export function resultOf(messages: Array<z.infer<typeof MessageSchema>>): SessionResult {
  const assistant = messages.find((m) => m.type === 'assistant')
  const text = (assistant?.content ?? [])
    .flatMap((p) => (p.type === 'text' && p.text ? [p.text] : []))
    .join('\n')
    .trim()
  const idle = messages[0]?.type === 'idle' ? messages[0] : undefined
  if (!idle) return { done: false, failed: false, text }
  const err = idle.error ?? assistant?.error
  const failed = idle.outcome !== 'succeeded' || Boolean(idle.error)
  return {
    done: true,
    failed,
    text,
    ...(failed ? { error: err ? describeError(err) : `run ${idle.outcome ?? 'ended'}` } : {}),
  }
}

export class OpencodeClient {
  readonly baseUrl: string
  private readonly authHeader?: string

  constructor(opts: OpencodeOptions = {}) {
    this.baseUrl = (opts.baseUrl || process.env.OPENCODE_URL || 'http://127.0.0.1:4096').replace(/\/$/, '')
    const auth = opencodeAuthHeader(opts.password)
    if (auth) this.authHeader = auth
  }

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(this.baseUrl + path, {
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

  /** A new session in `directory`. Agent and model are chosen here: v2 prompts don't carry them. */
  async createSession(
    directory: string,
    title?: string,
    opts: { agent?: string; model?: string } = {},
  ): Promise<string> {
    const body: Record<string, unknown> = { location: { directory } }
    if (opts.agent) body.agent = opts.agent
    if (opts.model) body.model = modelRef(opts.model)
    const session = SessionSchema.safeParse(
      await this.call('/api/session', { method: 'POST', body: JSON.stringify(body) }),
    )
    if (!session.success) throw new Error('opencode did not return a session id')
    const id = session.data.data.id
    if (title) await this.call(`/api/session/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
    return id
  }

  /** Queue a user message; returns once opencode accepted it, not when the run ends. */
  async promptAsync(sessionId: string, text: string): Promise<void> {
    await this.call(`/api/session/${sessionId}/prompt`, { method: 'POST', body: JSON.stringify({ text }) })
  }

  async abort(sessionId: string): Promise<void> {
    await this.call(`/api/session/${sessionId}/interrupt?resume=false`, { method: 'POST' }).catch(() => {})
  }

  /** Inspect the latest messages to decide whether the run finished. */
  async sessionResult(sessionId: string): Promise<SessionResult> {
    const msgs = MessagesSchema.safeParse(await this.call(`/api/session/${sessionId}/message?order=desc&limit=50`))
    return resultOf(msgs.success ? msgs.data.data : [])
  }

  /** Server health and version, or null when unreachable. */
  async healthInfo(): Promise<{ healthy: boolean; version?: string } | null> {
    try {
      const info = InfoSchema.safeParse(await this.call('/api/info'))
      if (!info.success) return null
      return { healthy: true, ...(info.data.version ? { version: info.data.version } : {}) }
    } catch {
      return null
    }
  }

  /** Subscribe to the event stream. Reconnects forever; returns a stop function. */
  subscribe(onEvent: (event: OpencodeEvent) => void, onStatus?: (connected: boolean) => void): () => void {
    // Aborting it ends the loop and cancels the open stream.
    const stop = new AbortController()
    const stopped = () => stop.signal.aborted

    const run = async () => {
      while (!stopped()) {
        try {
          const res = await fetch(`${this.baseUrl}/api/event`, {
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
              const event = parseSseEvent(buf.slice(0, idx))
              buf = buf.slice(idx + 2)
              if (event) onEvent(event)
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

/** One SSE block (`data:` lines; `:` heartbeats carry none) as an event, or null. */
export function parseSseEvent(block: string): OpencodeEvent | null {
  const data = block
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart())
    .join('\n')
  if (!data) return null
  const raw = RawEventSchema.safeParse(parseJson(data))
  if (!raw.success) return null
  const { type, location, data: payload } = raw.data
  return {
    ...(type ? { type } : {}),
    ...(payload?.sessionID ? { sessionID: payload.sessionID } : {}),
    ...(location?.directory ? { directory: location.directory } : {}),
  }
}
