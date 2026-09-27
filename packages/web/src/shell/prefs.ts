// Preferences in localStorage, kept in memory too so they still work for the session when
// localStorage is unavailable. `setPref` notifies every `usePref` reading the same key.

const memory = new Map<string, string>()
const PREFS_EVENT = 'zync:prefs'

export function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? fallback
  } catch {
    return memory.get(key) ?? fallback
  }
}

export function writePref(key: string, value: string) {
  memory.set(key, value)
  try {
    localStorage.setItem(key, value)
  } catch {}
}

export const subscribePrefs = (cb: () => void) => {
  window.addEventListener(PREFS_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(PREFS_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export const setPref = (key: string, value: string) => {
  writePref(key, value)
  window.dispatchEvent(new Event(PREFS_EVENT))
}
