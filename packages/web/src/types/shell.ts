import type { TreeEntry } from './files'
import type { Tip } from './onboarding'

export type DockMode = 'rail' | 'split' | 'full'
export type Theme = 'system' | 'light' | 'dark'

export type Creating = {
  dir: string
  kind: 'page' | 'folder'
}

export type Shell = {
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
  sides: Array<{ id: string; path: string }>
  /**
   * Split only: open `path` in the first side other than `fromId` (replacing what it shows).
   * Returns false when not split, so the caller can open it in place instead.
   */
  openInOther: (fromId: string, path: string) => boolean
  theme: Theme
  setTheme: (t: Theme) => void
  /** Spotlight one control with a short explanation (the "Get started" guide). */
  showTip: (tip: Tip) => void
}

/** A split pane beside the main view: its id (stable while it stays open) and the address it shows. */
export type Pane = {
  id: string
  path: string
}

export type TreeCtx = {
  ws: string
  current: string
  currentBoard: string
  currentDir: string
  boards: Set<string>
  cardCount: Map<string, number>
  cardAi: Map<string, 'running' | 'done' | undefined>
  creating: Creating | null
  renaming: string | null
  /** Open the entry; `beside` puts it in a split pane next to the current view. */
  open: (e: TreeEntry, beside?: boolean) => void
  selectDir: (dir: string) => void
  menu: (e: TreeEntry, x: number, y: number) => void
  create: (name: string) => void
  cancelCreate: () => void
  rename: (e: TreeEntry, name: string) => void
  cancelRename: () => void
  startRename: (e: TreeEntry) => void
  remove: (e: TreeEntry) => void
  moveInto: (froms: string[], dir: string) => void
  /** Drop `froms` just before or after `target` (moving them to target's folder first if needed). */
  place: (froms: string[], target: TreeEntry, where: 'before' | 'after', siblings: TreeEntry[]) => void
  /** Multi-select: ⌘/Ctrl-click toggles, Shift-click selects the range from the last one. */
  selected: Set<string>
  select: (path: string, mode: 'toggle' | 'range' | 'only') => void
  clearSelection: () => void
  removeMany: (paths: string[]) => void
}

export type TreeDropZone = 'before' | 'after' | 'into'

export type ViewContext = {
  kind:
    | 'overview'
    | 'file'
    | 'board'
    | 'jobs'
    | 'calendar'
    | 'opencode'
    | 'people'
    | 'memory'
    | 'boards'
    | 'files'
    | 'settings'
  label: string
}
