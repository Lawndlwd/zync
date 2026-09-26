export interface Workspace {
  name: string
  path: string
}

export interface AppConfig {
  chatUrl: string | null
  workspacesRoot: string
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
const ws = (name: string) => `/api/ws/${encodeURIComponent(name)}`

export const api = {
  config: () => req<AppConfig>('/api/config'),
  workspaces: () => req<Workspace[]>('/api/workspaces'),
  createWorkspace: (name: string) => req<Workspace>('/api/workspaces', json('POST', { name })),

  tree: (w: string, path: string) =>
    req<{ path: string; entries: TreeEntry[] }>(`${ws(w)}/tree?path=${encodeURIComponent(path)}`),
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

  eventsUrl: (w: string) => `${ws(w)}/events`,
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

/** opencode web addresses a project directory as base64url(path) in the URL. */
export function chatUrlFor(chatUrl: string, dir: string, sessionId?: string): string {
  const bytes = new TextEncoder().encode(dir)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const encoded = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const base = `${chatUrl.replace(/\/$/, '')}/${encoded}`
  return sessionId ? `${base}/session/${sessionId}` : base
}
