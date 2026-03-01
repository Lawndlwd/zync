import { createOpencodeClient } from '@opencode-ai/sdk'
import type { OpencodeClient } from '@opencode-ai/sdk'
import type {
  OpenCodeSession,
  OpenCodeMessage,
  OpenCodeProvider,
  OpenCodeConnectionStatus,
  OpenCodeTokens,
} from '../types/opencode'

const DEFAULT_SERVER_URL = 'http://localhost:4096'

// OpenCode timestamps may be in seconds or milliseconds depending on the endpoint
function toISO(ts: number): string {
  // If < 1e12 it's seconds, otherwise milliseconds
  return new Date(ts < 1e12 ? ts * 1000 : ts).toISOString()
}

let client: OpencodeClient | null = null
let currentServerUrl = DEFAULT_SERVER_URL

export function getOpenCodeClient(serverUrl?: string): OpencodeClient {
  const url = serverUrl || currentServerUrl
  if (!client || url !== currentServerUrl) {
    currentServerUrl = url
    client = createOpencodeClient({ baseUrl: url })
  }
  return client
}

export async function checkConnection(
  serverUrl?: string
): Promise<OpenCodeConnectionStatus> {
  try {
    const c = getOpenCodeClient(serverUrl)
    await c.config.get()
    return { connected: true, serverUrl: serverUrl || currentServerUrl }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Cannot connect to OpenCode server'
    return {
      connected: false,
      serverUrl: serverUrl || currentServerUrl,
      error: message,
    }
  }
}

export async function fetchProviders(
  serverUrl?: string
): Promise<OpenCodeProvider[]> {
  const c = getOpenCodeClient(serverUrl)
  const res = await c.config.providers()
  const data = res.data
  if (!data) return []
  // SDK returns { providers: Provider[], default: Record<string, string> }
  // Map SDK Provider (models as object) to our OpenCodeProvider (models as array)
  return data.providers.map((p) => ({
    id: p.id,
    name: p.name,
    models: Object.values(p.models).map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.providerID,
    })),
  }))
}

export async function fetchSessions(): Promise<OpenCodeSession[]> {
  const c = getOpenCodeClient()
  const res = await c.session.list()
  const sessions = res.data ?? []
  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: toISO(s.time.created),
    updatedAt: toISO(s.time.updated),
  }))
}

export async function getSession(
  sessionId: string
): Promise<OpenCodeSession> {
  const c = getOpenCodeClient()
  const res = await c.session.get({ path: { id: sessionId } })
  const s = res.data
  if (!s) throw new Error('Session not found')
  return {
    id: s.id,
    title: s.title,
    createdAt: toISO(s.time.created),
    updatedAt: toISO(s.time.updated),
  }
}

export const DASHBOARD_SESSION_PREFIX = '[dashboard] '

export async function createSession(
  title?: string
): Promise<OpenCodeSession> {
  const c = getOpenCodeClient()
  const prefixedTitle = `${DASHBOARD_SESSION_PREFIX}${title || 'New Session'}`
  const res = await c.session.create({
    body: { title: prefixedTitle },
  })
  const s = res.data
  if (!s) throw new Error('Failed to create session')
  return {
    id: s.id,
    title: s.title,
    createdAt: toISO(s.time.created),
    updatedAt: toISO(s.time.updated),
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const c = getOpenCodeClient()
  await c.session.delete({ path: { id: sessionId } })
}

export async function abortSession(sessionId: string): Promise<void> {
  const c = getOpenCodeClient()
  await c.session.abort({ path: { id: sessionId } })
}

export async function fetchMessages(
  sessionId: string
): Promise<OpenCodeMessage[]> {
  const c = getOpenCodeClient()
  const res = await c.session.messages({ path: { id: sessionId } })
  const items = res.data ?? []
  // SDK returns Array<{ info: Message, parts: Part[] }>
  // Part types include: text, tool, reasoning, subtask, file, step-start, step-finish, etc.
  // We map "text" and "tool" parts to our OpenCodePart types
  // Filter out synthetic messages (e.g. skill injections)
  return items
    .filter((item) => !item.parts.every((p) => (p as Record<string, unknown>).synthetic === true))
    .map((item) => ({
    id: item.info.id,
    sessionId: item.info.sessionID,
    role: item.info.role,
    parts: item.parts
      .filter((p) => p.type === 'text' || p.type === 'tool')
      .map((p) => {
        if (p.type === 'text') {
          const textPart = p as { type: 'text'; text: string }
          return { type: 'text' as const, text: textPart.text }
        }
        // SDK ToolPart: { type: "tool", callID, tool, state: ToolState }
        const toolPart = p as {
          type: 'tool'
          callID: string
          tool: string
          state: {
            status: string
            input: Record<string, unknown>
            output?: string
            error?: string
          }
        }
        return {
          type: 'tool-invocation' as const,
          toolInvocation: {
            id: toolPart.callID,
            toolName: toolPart.tool,
            args: toolPart.state.input,
            state: toolPart.state.status,
            result: toolPart.state.output ?? toolPart.state.error,
          },
        }
      }),
    createdAt: toISO(item.info.time.created),
    ...(item.info.role === 'assistant' ? {
      cost: (item.info as Record<string, unknown>).cost as number | undefined,
      tokens: (item.info as Record<string, unknown>).tokens as OpenCodeTokens | undefined,
      modelId: (item.info as Record<string, unknown>).modelID as string | undefined,
    } : {}),
  }))
}

export async function sendPrompt(
  sessionId: string,
  text: string,
  model?: { providerID: string; modelID: string }
): Promise<void> {
  const c = getOpenCodeClient()
  await c.session.promptAsync({
    path: { id: sessionId },
    body: {
      parts: [{ type: 'text', text }],
      ...(model ? { model } : {}),
    },
  })
}

