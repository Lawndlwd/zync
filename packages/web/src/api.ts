import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser'

import { encodePath } from './helpers/paths'
import type { AuthSession, AuthStatus, Passkey } from './types/auth'
import type {
  BecomingSlots,
  BecomingToday,
  BecomingWeek,
  Identity,
  IdentityInput,
  IdentityPatch,
  Mirror,
  VoteKind,
} from './types/becoming'
import type { Board, Card, CardPatch, Column } from './types/boards'
import type { Brief, BriefSummary } from './types/briefs'
import type { CalendarEvent, CalendarItem, EventPatch } from './types/calendar'
import type { Connection, ConnectionList, ExternalEvent, Gathered } from './types/connections'
import type { FileData, SearchResult, TreeEntry } from './types/files'
import type { JobRow, RunRecord } from './types/jobs'
import type { Memory, MemoryPatch, MemoryScope } from './types/memory'
import type { LibraryItem, LibraryKind, OpencodeHealth } from './types/opencode'
import type { Person } from './types/people'
import type {
  Exercise,
  ExerciseDetail,
  ExerciseInput,
  ExercisePage,
  ExerciseQuery,
  FinishResult,
  ProfileInput,
  ProgressRange,
  Routine,
  RoutineInput,
  RoutinePatch,
  TrainingProfile,
  TrainingProgress,
  TrainingToday,
  Workout,
  WorkoutSummary,
  WorkoutUpdate,
} from './types/training'
import type { AppConfig, Workspace } from './types/workspace'

/** A non-2xx answer from the API: `status`, and the JSON body (e.g. a 409's current mtime). */
export class ApiError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const errorText = (body: unknown): string | undefined =>
  typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' && body.error
    ? body.error
    : undefined

const AUTH = '/zync/api/auth'
const CONN = '/zync/api/connections'

/** Signed out (or the session ended): go to the sign-in page, then come back here. */
function signInAgain() {
  const { pathname, search } = window.location
  if (pathname !== '/login') window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`)
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (res.status === 401 && !url.startsWith(`${AUTH}/`)) signInAgain()
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}))
    throw new ApiError(res.status, errorText(body) ?? `${res.status} ${res.statusText}`, body)
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 204 No Content: only req<void> callers hit this path
  if (res.status === 204) return undefined as unknown as T
  return res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const ws = (name: string) => `/zync/api/ws/${encodeURIComponent(name)}`
const training = (w: string) => `${ws(w)}/training`
const memoryBase = (scope: MemoryScope, w: string) => (scope === 'global' ? '/zync/api/memory' : `${ws(w)}/memory`)

export const api = {
  authStatus: () => req<AuthStatus>(`${AUTH}/status`),
  setupOptions: (code: string) =>
    req<PublicKeyCredentialCreationOptionsJSON>(`${AUTH}/setup/options`, json('POST', { code })),
  setupVerify: (response: RegistrationResponseJSON, name: string) =>
    req<{ recoveryCodes: string[] }>(`${AUTH}/setup/verify`, json('POST', { response, name })),
  loginOptions: () => req<PublicKeyCredentialRequestOptionsJSON>(`${AUTH}/login/options`, json('POST', {})),
  loginVerify: (response: AuthenticationResponseJSON) =>
    req<{ ok: true }>(`${AUTH}/login/verify`, json('POST', { response })),
  recoverySignIn: (code: string) => req<{ ok: true }>(`${AUTH}/recovery`, json('POST', { code })),
  logout: () => req<void>(`${AUTH}/logout`, json('POST', {})),
  passkeys: () => req<Passkey[]>(`${AUTH}/passkeys`),
  passkeyOptions: () => req<PublicKeyCredentialCreationOptionsJSON>(`${AUTH}/passkeys/options`, json('POST', {})),
  addPasskey: (response: RegistrationResponseJSON, name: string) =>
    req<Passkey>(`${AUTH}/passkeys/verify`, json('POST', { response, name })),
  removePasskey: (id: string) => req<void>(`${AUTH}/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  authSessions: () => req<AuthSession[]>(`${AUTH}/sessions`),
  revokeSession: (id: string) => req<void>(`${AUTH}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  revokeOtherSessions: () => req<{ revoked: number }>(`${AUTH}/sessions/revoke-others`, json('POST', {})),
  newRecoveryCodes: () => req<{ recoveryCodes: string[] }>(`${AUTH}/recovery-codes`, json('POST', {})),

  config: () => req<AppConfig>('/zync/api/config'),
  workspaces: () => req<Workspace[]>('/zync/api/workspaces'),
  createWorkspace: (name: string) => req<Workspace>('/zync/api/workspaces', json('POST', { name })),

  tree: (w: string, path: string, hidden = false) =>
    req<{ path: string; entries: TreeEntry[] }>(
      `${ws(w)}/tree?path=${encodeURIComponent(path)}${hidden ? '&hidden=1' : ''}`,
    ),
  files: (w: string) => req<{ entries: TreeEntry[] }>(`${ws(w)}/files`),
  search: (w: string, q: string, signal?: AbortSignal) =>
    req<{ results: SearchResult[] }>(`${ws(w)}/search?q=${encodeURIComponent(q)}&limit=20`, { signal }),
  recent: (w: string, limit = 10) => req<{ total: number; entries: TreeEntry[] }>(`${ws(w)}/recent?limit=${limit}`),
  file: (w: string, path: string) => req<FileData>(`${ws(w)}/file/${encodePath(path)}`),
  rawUrl: (w: string, path: string) => `${ws(w)}/file/${encodePath(path)}?raw=1`,
  save: (w: string, path: string, content: string) =>
    req<{ mtime: number }>(`${ws(w)}/file/${encodePath(path)}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: content,
    }),
  remove: (w: string, path: string) => req<void>(`${ws(w)}/file/${encodePath(path)}`, { method: 'DELETE' }),
  mkdir: (w: string, path: string) => req<{ path: string }>(`${ws(w)}/folder`, json('POST', { path })),
  move: (w: string, from: string, to: string) =>
    req<{ from: string; to: string }>(`${ws(w)}/move`, json('POST', { from, to })),
  /** A fresh opencode v2 chat session for a workspace (no v2 URL creates one in place). */
  createChatSession: (w: string) => req<{ id: string }>(`${ws(w)}/chat/session`, json('POST', {})),
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
  runJob: (w: string, name: string) =>
    req<{ queued: string }>(`${ws(w)}/jobs/${encodeURIComponent(name)}/run`, { method: 'POST' }),
  setJobEnabled: (w: string, name: string, enabled: boolean) =>
    req<NonNullable<JobRow['job']>>(`${ws(w)}/jobs/${encodeURIComponent(name)}`, json('PATCH', { enabled })),
  deleteJob: (w: string, name: string) => req<void>(`${ws(w)}/jobs/${encodeURIComponent(name)}`, { method: 'DELETE' }),

  setJobAt: (w: string, name: string, at: string) =>
    req<NonNullable<JobRow['job']>>(`${ws(w)}/jobs/${encodeURIComponent(name)}`, json('PATCH', { at })),

  calendar: (w: string, from: string, to: string, signal?: AbortSignal) =>
    req<CalendarItem[]>(`${ws(w)}/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal }),
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

  briefs: (w: string, from: string, to: string, signal?: AbortSignal) =>
    req<BriefSummary[]>(`${ws(w)}/briefs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal }),
  brief: (w: string, date: string) => req<Brief>(`${ws(w)}/briefs/${encodeURIComponent(date)}`),
  briefTodoToCard: (w: string, date: string, index: number, board: string, status?: string) =>
    req<{ brief: Brief; card: string }>(
      `${ws(w)}/briefs/${encodeURIComponent(date)}/todos/${index}/card`,
      json('POST', { board, status }),
    ),
  setBriefTodoDone: (w: string, date: string, index: number, done: boolean) =>
    req<Brief>(`${ws(w)}/briefs/${encodeURIComponent(date)}/todos/${index}`, json('PATCH', { done })),
  enableBriefJob: (w: string) => req<unknown>(`${ws(w)}/briefs/job`, { method: 'POST' }),
  becomingToday: (w: string, date: string) =>
    req<BecomingToday>(`${ws(w)}/becoming/today?date=${encodeURIComponent(date)}`),
  becomingSlots: (w: string, from: string, to: string, signal?: AbortSignal) =>
    req<BecomingSlots>(`${ws(w)}/becoming/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      signal,
    }),
  identities: (w: string) => req<Identity[]>(`${ws(w)}/becoming/identities`),
  createIdentity: (w: string, input: IdentityInput) =>
    req<Identity>(`${ws(w)}/becoming/identities`, json('POST', input)),
  identity: (w: string, file: string) => req<Identity>(`${ws(w)}/becoming/identities/${encodeURIComponent(file)}`),
  updateIdentity: (w: string, file: string, patch: IdentityPatch) =>
    req<Identity>(`${ws(w)}/becoming/identities/${encodeURIComponent(file)}`, json('PATCH', patch)),
  deleteIdentity: (w: string, file: string) =>
    req<void>(`${ws(w)}/becoming/identities/${encodeURIComponent(file)}`, { method: 'DELETE' }),
  vote: (w: string, file: string, kind: VoteKind, date?: string, source: 'tap' | 'palette' = 'tap') =>
    req<unknown>(
      `${ws(w)}/becoming/identities/${encodeURIComponent(file)}/votes`,
      json('POST', { kind, source, ...(date ? { date } : {}) }),
    ),
  becomingWeek: (w: string, week: string) =>
    req<BecomingWeek>(`${ws(w)}/becoming/week?week=${encodeURIComponent(week)}`),
  mirrors: (w: string) => req<string[]>(`${ws(w)}/becoming/mirrors`),
  mirror: (w: string, week: string) => req<Mirror>(`${ws(w)}/becoming/mirrors/${encodeURIComponent(week)}`),
  answerMirror: (w: string, week: string, index: number, answer: string) =>
    req<Mirror>(`${ws(w)}/becoming/mirrors/${encodeURIComponent(week)}/questions/${index}`, json('PATCH', { answer })),
  applyMirrorChange: (w: string, week: string) =>
    req<unknown>(`${ws(w)}/becoming/mirrors/${encodeURIComponent(week)}/change`, { method: 'POST' }),
  enableMirrorJob: (w: string) => req<unknown>(`${ws(w)}/becoming/mirror-job`, { method: 'POST' }),
  becomingInterview: (w: string) => req<{ sessionId: string }>(`${ws(w)}/becoming/interview`, { method: 'POST' }),

  trainingProfile: (w: string) => req<TrainingProfile | null>(`${training(w)}/profile`),
  saveTrainingProfile: (w: string, profile: ProfileInput) =>
    req<TrainingProfile>(`${training(w)}/profile`, json('PUT', profile)),
  exercises: (w: string, query: ExerciseQuery, limit: number, signal?: AbortSignal) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(query.offset) })
    if (query.q) params.set('q', query.q)
    if (query.muscle) params.set('muscle', query.muscle)
    if (query.equipment) params.set('equipment', query.equipment)
    return req<ExercisePage>(`${training(w)}/exercises?${params.toString()}`, { signal })
  },
  exercise: (w: string, id: string) => req<ExerciseDetail>(`${training(w)}/exercises/${encodeURIComponent(id)}`),
  createExercise: (w: string, input: ExerciseInput) => req<Exercise>(`${training(w)}/exercises`, json('POST', input)),
  routines: (w: string) => req<Routine[]>(`${training(w)}/routines`),
  createRoutine: (w: string, input: RoutineInput) => req<Routine>(`${training(w)}/routines`, json('POST', input)),
  updateRoutine: (w: string, file: string, patch: RoutinePatch) =>
    req<Routine>(`${training(w)}/routines/${encodeURIComponent(file)}`, json('PATCH', patch)),
  deleteRoutine: (w: string, file: string) =>
    req<void>(`${training(w)}/routines/${encodeURIComponent(file)}`, { method: 'DELETE' }),
  trainingToday: (w: string) => req<TrainingToday>(`${training(w)}/today`),
  startWorkout: (w: string, routine?: string) =>
    req<Workout>(`${training(w)}/workouts`, json('POST', routine ? { routine } : {})),
  workouts: (w: string, month: string, signal?: AbortSignal) =>
    req<WorkoutSummary[]>(`${training(w)}/workouts?month=${encodeURIComponent(month)}`, { signal }),
  workout: (w: string, file: string) => req<Workout>(`${training(w)}/workouts/${encodeURIComponent(file)}`),
  saveWorkout: (w: string, file: string, update: WorkoutUpdate) =>
    req<Workout>(`${training(w)}/workouts/${encodeURIComponent(file)}`, json('PUT', update)),
  finishWorkout: (w: string, file: string) =>
    req<FinishResult>(`${training(w)}/workouts/${encodeURIComponent(file)}/finish`, { method: 'POST' }),
  deleteWorkout: (w: string, file: string) =>
    req<void>(`${training(w)}/workouts/${encodeURIComponent(file)}`, { method: 'DELETE' }),
  trainingProgress: (w: string, range: ProgressRange) =>
    req<TrainingProgress>(`${training(w)}/progress?range=${encodeURIComponent(range)}`),
  logBodyWeight: (w: string, kg: number, date?: string) =>
    req<unknown>(`${training(w)}/body`, json('POST', { kg, ...(date ? { date } : {}) })),
  trainingPlan: (w: string) => req<{ sessionId: string }>(`${training(w)}/plan`, { method: 'POST' }),

  connections: () => req<ConnectionList>(CONN),
  renameConnection: (id: string, label: string) =>
    req<Connection>(`${CONN}/${encodeURIComponent(id)}`, json('PATCH', { label })),
  removeConnection: (id: string) => req<void>(`${CONN}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  /** Where to send the browser for Google's consent screen; it comes back to `back`. */
  googleConnectUrl: (back: string) => req<{ url: string }>(`${CONN}/google`, json('POST', { back })),
  connectSlack: (token: string, label?: string) => req<Connection>(`${CONN}/slack`, json('POST', { token, label })),
  telegramStart: (apiId: string, apiHash: string, phone: string) =>
    req<{ login: string }>(`${CONN}/telegram/start`, json('POST', { apiId, apiHash, phone })),
  telegramCode: (login: string, code: string) =>
    req<{ connection?: Connection; password?: true }>(`${CONN}/telegram/code`, json('POST', { login, code })),
  telegramPassword: (login: string, password: string) =>
    req<{ connection: Connection }>(`${CONN}/telegram/password`, json('POST', { login, password })),
  /** Events of the connected Google calendars, read live. */
  externalEvents: (from: string, to: string, signal?: AbortSignal) =>
    req<Gathered<ExternalEvent>>(`${CONN}/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      signal,
    }),

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
    req<{ path: string; mtime: number; content: string }>(`/zync/api/opencode/files/${encodePath(path)}`),
  saveLibraryFile: (path: string, content: string, baseMtime?: number) =>
    req<{ mtime: number }>(`/zync/api/opencode/files/${encodePath(path)}`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain', ...(baseMtime ? { 'x-base-mtime': String(baseMtime) } : {}) },
      body: content,
    }),
  deleteLibraryEntry: (path: string) => req<void>(`/zync/api/opencode/files/${encodePath(path)}`, { method: 'DELETE' }),
  resetSkill: (name: string) =>
    req<void>(`/zync/api/opencode/skills/${encodeURIComponent(name)}/reset`, { method: 'POST' }),
  opencodeHealth: () => req<OpencodeHealth>('/zync/api/opencode/health'),
  restartOpencode: () => req<OpencodeHealth>('/zync/api/opencode/restart', { method: 'POST' }),
}
