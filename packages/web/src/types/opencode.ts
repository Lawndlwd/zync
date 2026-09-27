export type OpencodeHealth = {
  url: string
  healthy: boolean
  version?: string
}

export type LibraryKind = 'agent' | 'command' | 'skill'

export type LibraryItem = {
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
