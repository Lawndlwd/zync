// Daily briefs: Briefs/<date>.md, written by the daily-brief job. Mirrors @zync/jobs briefs/types.

export type Todo = {
  title: string
  /** Where it came from, e.g. "Gmail · work". */
  source?: string
  link?: string
  /** Workspace-relative card file, once turned into a card. */
  card?: string
  /** Ticked in the page's checklist. */
  done: boolean
}

export type Brief = {
  date: string
  todos: Todo[]
  sources: string[]
  /** The page without its to-do checklist. */
  body: string
}

export type BriefSummary = { date: string; todos: number; open: number }
