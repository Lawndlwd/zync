import { readPref, writePref } from './prefs'

// The docked chat reopens the conversation you were in, per workspace, instead of a fresh one on
// every page load. The chat runs on the app's own origin, so its address is readable here.

const key = (ws: string) => `zync:chatSession:${ws}`

export const lastChatSession = (ws: string) => readPref(key(ws), '') || null

export function rememberChatSession(ws: string, id: string | null) {
  writePref(key(ws), id ?? '')
}

/** "ses_…" from an opencode web address like /<dir>/session/ses_abc. */
export function sessionFromPath(pathname: string): string | null {
  return /\/session\/(ses_[A-Za-z0-9]+)/.exec(pathname)?.[1] ?? null
}

/** Does opencode still have this session (it may have been deleted)? */
export async function sessionExists(dir: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`/session/${encodeURIComponent(id)}?directory=${encodeURIComponent(dir)}`)
    return res.ok
  } catch {
    return false
  }
}
