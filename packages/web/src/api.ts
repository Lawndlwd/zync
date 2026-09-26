export interface OpencodeHealth {
  url: string
  healthy: boolean
  version?: string
}

export interface Workspace {
  name: string
  path: string
}

export interface AppConfig {
  workspacesRoot: string
  timezone: string
}

export interface TreeEntry {
  name: string
  path: string
  type: 'dir' | 'file'
  size: number
  mtime: number
}

export interface FileData {
  path: string
  size: number
  mtime: number
  binary: boolean
  content: string | null
}

export interface RunRecord {
  ts: string
  sessionId?: string
  status: 'ok' | 'failed' | 'timeout' | 'skipped'
  durationMs?: number
  summary: string
  trigger: 'schedule' | 'manual'
}

export interface JobRow {
  name: string
  error?: string
  job?: {
    name: string
    schedule?: string
    at?: string
    /** Workspace-relative card file when the job belongs to a board card. */
    card?: string
    timezone?: string
    agent?: string
    model?: string
    context: string[]
    notify: string
    enabled: boolean
    instructions: string
  }
  nextRuns: string[]
  lastRun: RunRecord | null
}

export interface Person {
  id: string
  name: string
  color?: string
  builtin?: boolean
}

export interface Column {
  id: string
  name: string
}

export interface Board {
  /** Workspace-relative folder path. */
  path: string
  name: string
  columns: Column[]
}

export interface Card {
  /** File name inside the board folder. */
  file: string
  title: string
  /** Column id; unset means the first column. */
  status?: string
  order?: number
  assignee?: string
  due?: string
  labels: string[]
  runAt?: string
  context: string[]
  ai?: { state: 'scheduled' | 'running' | 'done' | 'failed'; sessionId?: string; finishedAt?: string; summary?: string }
  description: string
  extra: Record<string, unknown>
}

/** `null` clears a field. */
export type CardPatch = Partial<{
  title: string
  status: string
  order: number
  assignee: string | null
  due: string | null
  labels: string[]
  runAt: string | null
  context: string[]
  description: string
}>

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/')
const ws = (name: string) => `/zync/api/ws/${encodeURIComponent(name)}`

export const api = {
  config: () => req<AppConfig>('/zync/api/config'),
  workspaces: () => req<Workspace[]>('/zync/api/workspaces'),
  createWorkspace: (name: string) => req<Workspace>('/zync/api/workspaces', json('POST', { name })),

  tree: (w: string, path: string) =>
    req<{ path: string; entries: TreeEntry[] }>(`${ws(w)}/tree?path=${encodeURIComponent(path)}`),
  recent: (w: string, limit = 10) => req<{ total: number; entries: TreeEntry[] }>(`${ws(w)}/recent?limit=${limit}`),
  file: (w: string, path: string) => req<FileData>(`${ws(w)}/file/${enc(path)}`),
  rawUrl: (w: string, path: string) => `${ws(w)}/file/${enc(path)}?raw=1`,
  save: (w: string, path: string, content: string) =>
    req<{ mtime: number }>(`${ws(w)}/file/${enc(path)}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: content,
    }),
  remove: (w: string, path: string) => req<void>(`${ws(w)}/file/${enc(path)}`, { method: 'DELETE' }),
  mkdir: (w: string, path: string) => req(`${ws(w)}/folder`, json('POST', { path })),
  move: (w: string, from: string, to: string) => req(`${ws(w)}/move`, json('POST', { from, to })),
  upload: (w: string, dir: string, files: FileList | File[]) => {
    const form = new FormData()
    for (const f of Array.from(files)) form.append('files', f)
    return req<{ saved: string[] }>(`${ws(w)}/upload?dir=${encodeURIComponent(dir)}`, { method: 'POST', body: form })
  },

  jobs: (w: string) => req<JobRow[]>(`${ws(w)}/jobs`),
  runs: (w: string, name: string) => req<RunRecord[]>(`${ws(w)}/jobs/${encodeURIComponent(name)}/runs`),
  runJob: (w: string, name: string) => req(`${ws(w)}/jobs/${encodeURIComponent(name)}/run`, { method: 'POST' }),
  setJobEnabled: (w: string, name: string, enabled: boolean) =>
    req(`${ws(w)}/jobs/${encodeURIComponent(name)}`, json('PATCH', { enabled })),
  deleteJob: (w: string, name: string) => req<void>(`${ws(w)}/jobs/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  people: () => req<Person[]>('/zync/api/people'),
  createPerson: (name: string, color?: string) => req<Person>('/zync/api/people', json('POST', { name, color })),
  updatePerson: (id: string, patch: { name?: string; color?: string }) =>
    req<Person>(`/zync/api/people/${encodeURIComponent(id)}`, json('PATCH', patch)),
  deletePerson: (id: string) => req<void>(`/zync/api/people/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  boards: (w: string) => req<Board[]>(`${ws(w)}/boards`),
  createBoard: (w: string, name: string, opts: { parent?: string; columns?: Column[] } = {}) =>
    req<Board>(`${ws(w)}/boards`, json('POST', { name, parent: opts.parent || undefined, columns: opts.columns })),
  board: (w: string, b: string) => req<{ board: Board; cards: Card[] }>(`${ws(w)}/boards/${encodeURIComponent(b)}`),
  updateBoard: (w: string, b: string, patch: { name?: string; columns?: Column[] }) =>
    req<Board>(`${ws(w)}/boards/${encodeURIComponent(b)}`, json('PATCH', patch)),
  deleteBoard: (w: string, b: string) => req<void>(`${ws(w)}/boards/${encodeURIComponent(b)}`, { method: 'DELETE' }),
  createCard: (w: string, b: string, input: CardPatch & { title: string }) =>
    req<Card>(`${ws(w)}/boards/${encodeURIComponent(b)}/cards`, json('POST', input)),
  updateCard: (w: string, b: string, id: string, patch: CardPatch) =>
    req<Card>(`${ws(w)}/boards/${encodeURIComponent(b)}/cards/${encodeURIComponent(id)}`, json('PATCH', patch)),
  deleteCard: (w: string, b: string, id: string) =>
    req<void>(`${ws(w)}/boards/${encodeURIComponent(b)}/cards/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  runCard: (w: string, b: string, id: string) =>
    req<Card>(`${ws(w)}/boards/${encodeURIComponent(b)}/cards/${encodeURIComponent(id)}/run`, { method: 'POST' }),

  eventsUrl: (w: string) => `${ws(w)}/events`,

  opencodeConfig: () =>
    req<{ path: string; exists: boolean; mtime: number; content: string }>('/zync/api/opencode/config'),
  saveOpencodeConfig: (content: string, baseMtime: number) =>
    req<{ mtime: number }>('/zync/api/opencode/config', {
      method: 'PUT',
      headers: { 'content-type': 'text/plain', 'x-base-mtime': String(baseMtime) },
      body: content,
    }),
  opencodeHealth: () => req<OpencodeHealth>('/zync/api/opencode/health'),
  restartOpencode: () => req<OpencodeHealth>('/zync/api/opencode/restart', { method: 'POST' }),
}

export function dirname(p: string): string {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

export function basename(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1)
}

export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name
}

/**
 * The chat for a workspace. opencode's web UI is served through this app (see api/opencode-proxy),
 * and addresses a project directory as base64url(path).
 */
export function chatUrlFor(dir: string, sessionId?: string): string {
  const bytes = new TextEncoder().encode(dir)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const encoded = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const base = `/${encoded}`
  return sessionId ? `${base}/session/${sessionId}` : base
}
