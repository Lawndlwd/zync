import { encodePath } from './paths'

// App URLs. Workspace pages live under /w/<ws>/…; each path segment is encoded.

export const wsUrl = (ws: string, rest = '') => `/w/${encodeURIComponent(ws)}${rest ? `/${rest}` : ''}`

export const fileUrl = (ws: string, p: string) => wsUrl(ws, `files/${encodePath(p)}`)

/** URL path for a board folder. */
export const boardUrl = (ws: string, boardPath: string) => wsUrl(ws, `boards/${encodePath(boardPath)}`)

/** The OpenCode page, or one of its library files. */
export const libraryUrl = (ws: string, path = '') => wsUrl(ws, `opencode${path ? `/${encodePath(path)}` : ''}`)

export const sessionUrl = (ws: string, sessionId: string) => wsUrl(ws, `chat?session=${encodeURIComponent(sessionId)}`)

export function chatUrlFor(dir: string, sessionId?: string): string {
  const bytes = new TextEncoder().encode(dir)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const encoded = btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
  const base = `/${encoded}`
  return sessionId ? `${base}/session/${sessionId}` : base
}

export const folderUrl = (ws: string, dir: string) => wsUrl(ws, dir ? `files?dir=${encodeURIComponent(dir)}` : 'files')
