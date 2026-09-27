import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'

export type DockMode = 'rail' | 'split' | 'full'
export type Theme = 'system' | 'light' | 'dark'

export interface Creating {
  dir: string
  kind: 'page' | 'folder'
}

export interface Shell {
  ws: string
  dock: DockMode
  /** ⌘J: rail ⇄ split (full screen under 1024px, where split isn't offered). */
  toggleDock: () => void
  /** ⌘⇧J: full-screen chat, or back to where you were. */
  toggleFull: () => void
  openPalette: () => void
  /** Start an inline "new page / folder" row in the sidebar tree. */
  startCreate: (c: Creating) => void
  /** Open a workspace URL in a split pane beside the main view (max 2 extra panes). */
  openBeside: (path: string) => void
  /** Open a workspace URL in the selected side (the main view when not split). */
  open: (path: string) => void
  /** Address shown by the selected side — what the sidebar highlights. */
  activePath: string
  /** Every side's current address (main first), when split. */
  sides: { id: string; path: string }[]
  /**
   * Split only: open `path` in the first side other than `fromId` (replacing what it shows).
   * Returns false when not split, so the caller can open it in place instead.
   */
  openInOther: (fromId: string, path: string) => boolean
  theme: Theme
  setTheme: (t: Theme) => void
}

export const ShellContext = createContext<Shell | null>(null)

export function useShell(): Shell {
  const s = useContext(ShellContext)
  if (!s) throw new Error('useShell outside Layout')
  return s
}

export function readPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}

/** A localStorage-backed string preference. */
export function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => readPref(key, fallback) as T)
  useEffect(() => writePref(key, v), [key, v])
  return [v, setV]
}

/** Applies the theme to <html data-theme>, following the OS when set to "system". */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = usePref<Theme>('zync:theme', 'system')
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
  return [theme, setTheme]
}

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

export const wsUrl = (ws: string, rest = '') => `/w/${encodeURIComponent(ws)}${rest ? `/${rest}` : ''}`

export const fileUrl = (ws: string, p: string) => wsUrl(ws, `files/${p.split('/').map(encodeURIComponent).join('/')}`)

const HIDDEN_KEY = 'zync:hidden-files'
const PREFS_EVENT = 'zync:prefs'

/** Show dotfiles (.board.json, .opencode/…) in the file tree. Shared live by every tree on the page. */
export function useShowHidden(): [boolean, (v: boolean) => void] {
  const on = useSyncExternalStore(
    (cb) => {
      window.addEventListener(PREFS_EVENT, cb)
      window.addEventListener('storage', cb)
      return () => {
        window.removeEventListener(PREFS_EVENT, cb)
        window.removeEventListener('storage', cb)
      }
    },
    () => readPref(HIDDEN_KEY, '0') === '1',
  )
  const set = (v: boolean) => {
    writePref(HIDDEN_KEY, v ? '1' : '0')
    window.dispatchEvent(new Event(PREFS_EVENT))
  }
  return [on, set]
}
