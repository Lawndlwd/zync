export interface SearchResult {
  name: string
  path: string
  size: number
  mtime: number
  score: number
  /** Matching lines, best first (1-based line numbers). */
  snippets: { line: number; text: string }[]
}

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

export type MemoryScope = 'global' | 'workspace'
export const MEMORY_TYPES = ['rule', 'preference', 'habit', 'fact'] as const
export type MemoryType = (typeof MEMORY_TYPES)[number]

/** Something the AI remembers: a markdown file in `.zync/memory/` (global or in the workspace). */
export interface Memory {
  file: string
  title: string
  scope: MemoryScope
  type?: MemoryType
  description?: string
  pinned: boolean
  updated: string
  body: string
}

export interface MemoryPatch {
  title?: string
  type?: MemoryType | null
  description?: string | null
  pinned?: boolean
  body?: string
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
  /** Minutes on the calendar; unset = 60. */
  duration?: number
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
  duration: number | null
  labels: string[]
  runAt: string | null
  context: string[]
  description: string
}>

export type LibraryKind = 'agent' | 'command' | 'skill'

/** An agent, command or skill in opencode's config folder. */
export interface LibraryItem {
  kind: LibraryKind
  name: string
  /** Markdown file relative to the config folder, e.g. "skills/kanban/SKILL.md". */
  path: string
  description?: string
  builtin?: boolean
  modified?: boolean
  files?: string[]
  mtime: number
  error?: string
}

export type CalendarKind = 'event' | 'card' | 'card-ai' | 'job' | 'run'

/** Anything with a time, as the calendar shows it. Times are local wall-clock strings. */
export interface CalendarItem {
  id: string
  kind: CalendarKind
  title: string
  /** "YYYY-MM-DD" when all-day, else "YYYY-MM-DDTHH:MM". */
  start: string
  /** Inclusive last day when all-day, else the end time. */
  end: string
  allDay: boolean
  /** Workspace-relative file (events, cards) or job name (jobs, runs). */
  ref: string
  board?: string
  file?: string
  assignee?: string
  people?: string[]
  status?: string
  ai?: string
  recurring?: boolean
  editable: boolean
}

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'

/** A recurring event's rule (the event's `repeat` frontmatter). */
export interface Repeat {
  every: 'day' | 'week' | 'month' | 'year'
  interval?: number
  days?: Weekday[]
  until?: string
  except?: string[]
}

export interface CalendarEvent {
  file: string
  title: string
  start: string
  end?: string
  people: string[]
  repeat?: Repeat
  description: string
}

export type EventPatch = Partial<{
  title: string
  start: string
  end: string | null
  people: string[]
  repeat: Repeat | null
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
const memoryBase = (scope: MemoryScope, w: string) => (scope === 'global' ? '/zync/api/memory' : `${ws(w)}/memory`)

export const api = {
  config: () => req<AppConfig>('/zync/api/config'),
  workspaces: () => req<Workspace[]>('/zync/api/workspaces'),
  createWorkspace: (name: string) => req<Workspace>('/zync/api/workspaces', json('POST', { name })),

  tree: (w: string, path: string, hidden = false) =>
    req<{ path: string; entries: TreeEntry[] }>(
      `${ws(w)}/tree?path=${encodeURIComponent(path)}${hidden ? '&hidden=1' : ''}`,
    ),
  files: (w: string) => req<{ entries: TreeEntry[] }>(`${ws(w)}/files`),
  search: (w: string, q: string) =>
    req<{ results: SearchResult[] }>(`${ws(w)}/search?q=${encodeURIComponent(q)}&limit=20`),
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
  /** Sidebar order of one folder's entries (names). */
  setOrder: (w: string, dir: string, names: string[]) => req<void>(`${ws(w)}/order`, json('PUT', { dir, names })),
  upload: (w: string, dir: string, files: FileList | File[]) => {
    const form = new FormData()
    // A folder upload sends each file's path inside the folder ("photos/2026/a.jpg") as its name.
    for (const f of Array.from(files)) form.append('files', f, f.webkitRelativePath || f.name)
    return req<{ saved: string[] }>(`${ws(w)}/upload?dir=${encodeURIComponent(dir)}`, { method: 'POST', body: form })
  },

  jobs: (w: string) => req<JobRow[]>(`${ws(w)}/jobs`),
  runs: (w: string, name: string) => req<RunRecord[]>(`${ws(w)}/jobs/${encodeURIComponent(name)}/runs`),
  runJob: (w: string, name: string) => req(`${ws(w)}/jobs/${encodeURIComponent(name)}/run`, { method: 'POST' }),
  setJobEnabled: (w: string, name: string, enabled: boolean) =>
    req(`${ws(w)}/jobs/${encodeURIComponent(name)}`, json('PATCH', { enabled })),
  deleteJob: (w: string, name: string) => req<void>(`${ws(w)}/jobs/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  setJobAt: (w: string, name: string, at: string) =>
    req(`${ws(w)}/jobs/${encodeURIComponent(name)}`, json('PATCH', { at })),

  calendar: (w: string, from: string, to: string) => req<CalendarItem[]>(`${ws(w)}/calendar?from=${from}&to=${to}`),
  createEvent: (w: string, input: EventPatch & { title: string; start: string }) =>
    req<CalendarEvent>(`${ws(w)}/calendar/events`, json('POST', input)),
  event: (w: string, file: string) => req<CalendarEvent>(`${ws(w)}/calendar/events/${encodeURIComponent(file)}`),
  updateEvent: (w: string, file: string, patch: EventPatch) =>
    req<CalendarEvent>(`${ws(w)}/calendar/events/${encodeURIComponent(file)}`, json('PATCH', patch)),
  deleteEvent: (w: string, file: string) =>
    req<void>(`${ws(w)}/calendar/events/${encodeURIComponent(file)}`, { method: 'DELETE' }),

  people: () => req<Person[]>('/zync/api/people'),
  createPerson: (name: string, color?: string) => req<Person>('/zync/api/people', json('POST', { name, color })),
  updatePerson: (id: string, patch: { name?: string; color?: string }) =>
    req<Person>(`/zync/api/people/${encodeURIComponent(id)}`, json('PATCH', patch)),
  deletePerson: (id: string) => req<void>(`/zync/api/people/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  personNotes: (id: string) => req<{ notes: string }>(`/zync/api/people/${encodeURIComponent(id)}/notes`),
  savePersonNotes: (id: string, notes: string) =>
    req<{ notes: string }>(`/zync/api/people/${encodeURIComponent(id)}/notes`, json('PUT', { notes })),

  memories: (scope: MemoryScope, w: string) => req<Memory[]>(memoryBase(scope, w)),
  createMemory: (scope: MemoryScope, w: string, input: MemoryPatch & { title: string }) =>
    req<Memory>(memoryBase(scope, w), json('POST', input)),
  updateMemory: (scope: MemoryScope, w: string, file: string, patch: MemoryPatch) =>
    req<Memory>(`${memoryBase(scope, w)}/${encodeURIComponent(file)}`, json('PATCH', patch)),
  deleteMemory: (scope: MemoryScope, w: string, file: string) =>
    req<void>(`${memoryBase(scope, w)}/${encodeURIComponent(file)}`, { method: 'DELETE' }),
  /** The memory block the AI gets in its system prompt in this workspace. */
  memoryPrompt: (w: string) => req<{ text: string }>(`${ws(w)}/memory/prompt`),

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
  opencodeLibrary: () => req<{ dir: string; items: LibraryItem[] }>('/zync/api/opencode/library'),
  createLibraryItem: (kind: LibraryKind, name: string, description?: string) =>
    req<{ path: string }>('/zync/api/opencode/library', json('POST', { kind, name, description })),
  libraryFile: (path: string) =>
    req<{ path: string; mtime: number; content: string }>(`/zync/api/opencode/files/${enc(path)}`),
  saveLibraryFile: (path: string, content: string, baseMtime?: number) =>
    req<{ mtime: number }>(`/zync/api/opencode/files/${enc(path)}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain', ...(baseMtime ? { 'x-base-mtime': String(baseMtime) } : {}) },
      body: content,
    }),
  deleteLibraryEntry: (path: string) => req<void>(`/zync/api/opencode/files/${enc(path)}`, { method: 'DELETE' }),
  resetSkill: (name: string) =>
    req<void>(`/zync/api/opencode/skills/${encodeURIComponent(name)}/reset`, { method: 'POST' }),
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
