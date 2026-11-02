import type { TrainingTab } from '../types/training'
import { encodePath } from './paths'

// App URLs. Workspace pages live under /w/<ws>/…; each path segment is encoded.

export const wsUrl = (ws: string, rest = '') => `/w/${encodeURIComponent(ws)}${rest ? `/${rest}` : ''}`

export const fileUrl = (ws: string, p: string) => wsUrl(ws, `files/${encodePath(p)}`)

/** URL path for a board folder. */
export const boardUrl = (ws: string, boardPath: string) => wsUrl(ws, `boards/${encodePath(boardPath)}`)

/** The OpenCode page, or one of its library files. */
export const libraryUrl = (ws: string, path = '') => wsUrl(ws, `opencode${path ? `/${encodePath(path)}` : ''}`)

export const sessionUrl = (ws: string, sessionId: string) => wsUrl(ws, `chat?session=${encodeURIComponent(sessionId)}`)

/** opencode v2's chat session page for this origin: `/server/<base64url(origin)>/session/<id>`. */
export function chatUrlFor(origin: string, sessionId: string): string {
  const bytes = new TextEncoder().encode(origin)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const encoded = btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  return `/server/${encoded}/session/${encodeURIComponent(sessionId)}`
}

export const folderUrl = (ws: string, dir: string) => wsUrl(ws, dir ? `files?dir=${encodeURIComponent(dir)}` : 'files')

/** The Becoming board, with one identity's page open beside it. */
export const identityUrl = (ws: string, file: string) => wsUrl(ws, `becoming?open=${encodeURIComponent(file)}`)

/** Training: Today, or one of its tabs (and the setup form). */
export const trainingUrl = (ws: string, tab?: TrainingTab) => wsUrl(ws, tab ? `training/${tab}` : 'training')

/** The live (or finished) workout page. */
export const workoutUrl = (ws: string, file: string) => wsUrl(ws, `training/workout/${encodeURIComponent(file)}`)

/** The routines list, with one routine's editor open beside it. */
export const routineUrl = (ws: string, file: string) =>
  `${trainingUrl(ws, 'routines')}?open=${encodeURIComponent(file)}`
