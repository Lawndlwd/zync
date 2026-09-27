import { readPref, type Theme, writePref } from './context'

// The chat is opencode's web UI served on the app's own domain, so its per-browser preferences live
// in this origin's localStorage and zync can set them. These keys are opencode internals (web UI
// 1.18): if a future opencode renames one, the matching control here simply stops having an effect.

const KEY = {
  theme: 'opencode-theme-id',
  scheme: 'opencode-color-scheme',
  cssLight: 'opencode-theme-css-light',
  cssDark: 'opencode-theme-css-dark',
  settings: 'settings.v3',
  catalog: 'opencode.global.dat:command.catalog.v1',
}

export const DEFAULT_CHAT_THEME = 'matrix'
const FOLLOW = 'zync:chatFollowTheme'

// opencode 1.18's built-in themes; the live list is read from opencode's command catalog when present.
const BUILTIN = [
  'amoled',
  'aura',
  'ayu',
  'carbonfox',
  'catppuccin',
  'catppuccin-frappe',
  'catppuccin-macchiato',
  'cobalt2',
  'cursor',
  'dracula',
  'everforest',
  'flexoki',
  'github',
  'gruvbox',
  'kanagawa',
  'lucent-orng',
  'material',
  'matrix',
  'mercury',
  'monokai',
  'nightowl',
  'nord',
  'oc-2',
  'one-dark',
  'onedarkpro',
  'opencode',
  'orng',
  'osaka-jade',
  'palenight',
  'rosepine',
  'shadesofpurple',
  'solarized',
  'synthwave84',
  'tokyonight',
  'vercel',
  'vesper',
  'zenburn',
]

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {}
}

function json<T>(key: string): T | null {
  const raw = get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Ask the docked chat to reload so it picks up changed preferences. */
export function reloadChat() {
  window.dispatchEvent(new Event('zync:chat-reload'))
}

// ── theme ──────────────────────────────────────────────────────────────────

export function chatThemes(): { id: string; name: string }[] {
  const catalog = json<Record<string, { title?: string }>>(KEY.catalog)
  const live = catalog
    ? Object.entries(catalog)
        .filter(([k]) => k.startsWith('theme.set.'))
        .map(([k, v]) => ({ id: k.slice('theme.set.'.length), name: (v.title ?? '').replace(/^Use theme:\s*/, '') }))
    : []
  if (live.length) return live
  return BUILTIN.map((id) => ({ id, name: id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))
}

export const chatTheme = () => get(KEY.theme)

export function setChatTheme(id: string) {
  if (get(KEY.theme) === id) return
  set(KEY.theme, id)
  // Cached CSS of the previous theme, used for opencode's first paint; it regenerates them.
  set(KEY.cssLight, null)
  set(KEY.cssDark, null)
}

// ── light / dark ───────────────────────────────────────────────────────────

export const followsZyncTheme = () => readPref(FOLLOW, '1') === '1'

export function setFollowsZyncTheme(on: boolean, theme: Theme) {
  writePref(FOLLOW, on ? '1' : '0')
  if (on) set(KEY.scheme, theme)
}

export const chatScheme = () => (get(KEY.scheme) as Theme | null) ?? 'system'
export const setChatScheme = (s: Theme) => set(KEY.scheme, s)

/**
 * Runs before the chat loads and whenever zync's theme changes: Matrix for a browser that never
 * picked a chat theme, and the chat's light/dark following zync's. Returns true if anything changed.
 */
export function applyChatDefaults(theme: Theme): boolean {
  let changed = false
  if (!get(KEY.theme)) {
    setChatTheme(DEFAULT_CHAT_THEME)
    changed = true
  }
  if (followsZyncTheme() && get(KEY.scheme) !== theme) {
    set(KEY.scheme, theme)
    changed = true
  }
  return changed
}

// ── opencode's settings.v3 ─────────────────────────────────────────────────

export interface ChatSettings {
  general: {
    showFileTree?: boolean
    showNavigation?: boolean
    showSearch?: boolean
    showStatus?: boolean
    showTerminal?: boolean
    showReasoningSummaries?: boolean
    [k: string]: unknown
  }
  appearance: { fontSize?: number; [k: string]: unknown }
  sounds: { agentEnabled?: boolean; permissionsEnabled?: boolean; errorsEnabled?: boolean; [k: string]: unknown }
  [k: string]: unknown
}

/** null until the chat has been opened once in this browser (opencode creates the settings then). */
export const chatSettings = () => json<ChatSettings>(KEY.settings)

/** Change some of opencode's settings, keeping every other field as opencode wrote it. */
export function patchChatSettings(fn: (s: ChatSettings) => void): boolean {
  const s = chatSettings()
  if (!s) return false
  s.general ??= {}
  s.appearance ??= {}
  s.sounds ??= {}
  fn(s)
  set(KEY.settings, JSON.stringify(s))
  return true
}
