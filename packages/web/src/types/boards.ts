export type Column = {
  id: string
  name: string
}

export type Board = {
  /** Workspace-relative folder path. */
  path: string
  name: string
  columns: Column[]
}

export type Card = {
  /** File name inside the board folder. */
  file: string
  title: string
  /** Column id; unset means the first column. */
  status?: string
  order?: number
  assignee?: string
  due?: string
  /** Minutes on the calendar; unset = 60. */
  duration?: number
  labels: string[]
  runAt?: string
  context: string[]
  ai?: { state: 'scheduled' | 'running' | 'done' | 'failed'; sessionId?: string; finishedAt?: string; summary?: string }
  description: string
  extra: Record<string, unknown>
}

export type CardPatch = Partial<{
  title: string
  status: string
  order: number
  assignee: string | null
  due: string | null
  duration: number | null
  labels: string[]
  runAt: string | null
  context: string[]
  description: string
}>

/** A card's fields: its frontmatter plus the markdown body. `title` is the file name. */
export type Draft = {
  title: string
  status: string
  assignee?: string
  due?: string
  duration?: number
  labels: string[]
  description: string
  runAt?: string
  context: string[]
}

/** What the inline composer collects before a card exists. */
export type QuickCard = {
  title: string
  due?: string
}

export type DropTarget = {
  column: string
  index: number
}
