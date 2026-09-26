// Raw HTTP client for the opencode server. The SDK proved unreliable in the past
// (empty prompt responses, model inheritance bugs), so we call the API directly.

export interface OpencodeOptions {
  baseUrl?: string
  password?: string
  username?: string
}

export interface SessionResult {
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

  private async call(path: string, directory: string | undefined, init: RequestInit = {}): Promise<any> {
    const url = new URL(this.baseUrl + path)
    if (directory) url.searchParams.set('directory', directory)
    const res = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(this.authHeader ? { authorization: this.authHeader } : {}),
        ...init.headers,
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
    const session = await this.call('/session', directory, {
      method: 'POST',
      body: JSON.stringify({ title, ...(agent ? { agent } : {}) }),
    })
    if (!session?.id) throw new Error('opencode did not return a session id')
    return session.id
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
    const msgs: any[] = (await this.call(`/session/${sessionId}/message`, directory)) || []
    const last = [...msgs].reverse().find((m) => m?.info?.role === 'assistant')
    if (!last) return { done: false, failed: false, text: '' }
    const info = last.info
    const text = (last.parts || [])
      .filter((p: any) => p.type === 'text' && p.text)
      .map((p: any) => p.text)
      .join('\n')
      .trim()
    const error = info.error ? describeError(info.error) : undefined
    // A message that ended on tool calls means the agent loop continues with another message.
    const completed = Boolean(info.time?.completed) && info.finish !== 'tool-calls'
    return { done: completed || Boolean(error), failed: Boolean(error), text, error }
  }

  async health(): Promise<boolean> {
    try {
      await this.call('/config', undefined)
      return true
    } catch {
      return false
    }
  }

  /**
   * Subscribe to the global event stream. Reconnects forever; returns a stop function.
   * `onEvent` receives `{ directory, payload: { type, properties } }`.
   */
  subscribe(onEvent: (event: any) => void, onStatus?: (connected: boolean) => void): () => void {
    let stopped = false
    let controller: AbortController | undefined

    const run = async () => {
      while (!stopped) {
        controller = new AbortController()
        try {
          const res = await fetch(`${this.baseUrl}/global/event`, {
            headers: { accept: 'text/event-stream', ...(this.authHeader ? { authorization: this.authHeader } : {}) },
            signal: controller.signal,
          })
          if (!res.ok || !res.body) throw new Error(`event stream → ${res.status}`)
          onStatus?.(true)
          const decoder = new TextDecoder()
          let buf = ''
          for await (const chunk of res.body as any as AsyncIterable<Uint8Array>) {
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
              try {
                onEvent(JSON.parse(data))
              } catch {
                // ignore malformed event
              }
            }
          }
        } catch {
          // fall through to reconnect
        }
        onStatus?.(false)
        if (!stopped) await new Promise((r) => setTimeout(r, 3000))
      }
    }
    void run()
    return () => {
      stopped = true
      controller?.abort()
    }
  }
}

function describeError(err: any): string {
  return err?.data?.message || err?.message || err?.name || JSON.stringify(err)
}
