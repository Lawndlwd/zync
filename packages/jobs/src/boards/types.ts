import { z } from 'zod'

import { DATE_TIME_RE, WHEN_RE, wallClockField } from '../helpers/dates.js'
import type { RunRecord } from '../runs.js'

// A board is an ordinary workspace folder marked by a hidden `.board.json` (its columns).
// Every markdown file directly inside it is a card: the file name is the title, the frontmatter
// holds the card fields (status, assignee, due, …) and the body is the description.
//
//   <ws>/Sprint 1/.board.json
//   <ws>/Sprint 1/Write the report.md
//
// A card assigned to "ai" with a run time gets a linked one-shot job (.opencode/jobs/card-….md);
// the scheduler runs it like any job and moves the card through doing → review (or back to todo).

export const BOARD_FILE = '.board.json'
export const AI_ASSIGNEE = 'ai'

/** Column ids the scheduler relies on. Names are free; missing columns are simply skipped. */
export const DEFAULT_COLUMNS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'To do' },
  { id: 'doing', name: 'In progress' },
  { id: 'review', name: 'Review' },
  { id: 'done', name: 'Done' },
]

export const ID_RE = /^[a-z0-9][a-z0-9-]{0,29}$/

export const ColumnSchema = z.object({ id: z.string().regex(ID_RE), name: z.string().trim().min(1).max(40) })
export type Column = z.infer<typeof ColumnSchema>

export const BoardFileSchema = z.object({
  columns: z
    .array(ColumnSchema)
    .min(1)
    .refine((cols) => new Set(cols.map((c) => c.id)).size === cols.length, { message: 'duplicate column id' }),
})

export type Board = {
  /** Workspace-relative folder path, e.g. "Sprint 1" or "projects/Sprint 1". */
  path: string
  name: string
  columns: Column[]
}

/** The column new cards go to (a board file always has at least one column). */
export const firstColumn = (board: Pick<Board, 'columns'>): string => board.columns[0]?.id ?? 'backlog'

const AiStateSchema = z.object({
  state: z.enum(['scheduled', 'running', 'done', 'failed']),
  sessionId: z.string().optional(),
  finishedAt: z.string().optional(),
  summary: z.string().optional(),
})
export type CardAi = z.infer<typeof AiStateSchema>

/** Frontmatter keys we manage, in the order they are written. Anything else is kept as-is. */
export const CARD_FIELDS = {
  title: z.string().trim().min(1).max(200),
  status: z.string().regex(ID_RE),
  assignee: z.string().regex(ID_RE),
  due: wallClockField(WHEN_RE, 'due must look like 2026-09-28 or 2026-09-28T15:14'),
  /** Minutes the card takes on the calendar (from `due`, or `runAt` for the AI). Unset = 1 hour. */
  duration: z.number().int().min(5).max(1440),
  labels: z.array(z.string().trim().min(1).max(30)),
  runAt: wallClockField(DATE_TIME_RE, 'runAt must be a local date-time like 2026-09-28T15:14'),
  context: z.array(z.string()),
  order: z.number(),
  ai: AiStateSchema,
}
type FieldName = keyof typeof CARD_FIELDS
export const isCardField = (k: string): k is FieldName => Object.hasOwn(CARD_FIELDS, k)

export type Card = {
  /** File name inside the board folder, e.g. "Write the report.md". */
  file: string
  title: string
  status?: string
  assignee?: string
  due?: string
  duration?: number
  labels: string[]
  runAt?: string
  context: string[]
  order?: number
  ai?: CardAi
  description: string
  /** Frontmatter keys we don't manage (or couldn't parse), preserved on write. */
  extra: Record<string, unknown>
}

/** Fields a caller may set. `null` clears an optional field. */
export type CardPatch = {
  title?: string
  status?: string
  order?: number
  assignee?: string | null
  due?: string | null
  duration?: number | null
  labels?: string[]
  runAt?: string | null
  context?: string[]
  description?: string
}

export type CardRunEvent =
  | { type: 'started'; sessionId: string }
  | { type: 'finished'; run: Pick<RunRecord, 'status' | 'summary' | 'sessionId' | 'ts'> }
