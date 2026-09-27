// Split panes live in the page URL: /w/ggg/files/notes/a.md?p1=boards%2FSprint%201&p2=… Each value is
// the pane's address relative to the workspace (its own query, e.g. ?card=, stays encoded inside), so
// pane parameters can't clash with the main view's (?card=, ?who=, ?dir=…).

export const PANE_KEYS = ['p1', 'p2'] as const

const prefix = (ws: string) => `/w/${encodeURIComponent(ws)}/`

/** Full pane addresses (/w/ws/…) from a search string. */
export function panesFromSearch(ws: string, search: string): string[] {
  const q = new URLSearchParams(search)
  return PANE_KEYS.map((k) => q.get(k))
    .filter((v): v is string => !!v && !v.startsWith('/') && !v.includes('..'))
    .map((v) => prefix(ws) + v)
}

/** `search` with the pane parameters set to `paths` (others untouched). Returns "" or "?…". */
export function withPanes(ws: string, search: string, paths: string[]): string {
  const q = new URLSearchParams(search)
  for (const k of PANE_KEYS) q.delete(k)
  const kept = paths.filter((p) => p.startsWith(prefix(ws))).slice(0, PANE_KEYS.length)
  kept.forEach((p, i) => {
    q.set(PANE_KEYS[i], p.slice(prefix(ws).length))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** `search` without the pane parameters: what the main view itself is showing. */
export const withoutPanes = (search: string) => {
  const q = new URLSearchParams(search)
  for (const k of PANE_KEYS) q.delete(k)
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** "/w/ws/boards/x?card=a" → { pathname, search } */
export function splitPath(path: string): { pathname: string; search: string } {
  const i = path.indexOf('?')
  return i < 0 ? { pathname: path, search: '' } : { pathname: path.slice(0, i), search: path.slice(i) }
}
