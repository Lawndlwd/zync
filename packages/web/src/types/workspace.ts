import type { Board, Card } from './boards'
import type { TreeEntry } from './files'
import type { JobRow, RunRecord } from './jobs'
import type { Person } from './people'

export type Workspace = {
  name: string
  path: string
}

export type AppConfig = {
  workspacesRoot: string
  timezone: string
}

export type BoardCard = {
  board: Board
  card: Card
  /** Workspace-relative card file — what a card's job points at. */
  ref: string
}

export type RunEvent = {
  job: string
  title: string
  kind: 'job' | 'card'
  run: RunRecord
  time: Date
}

export type WorkspaceData = {
  jobs: JobRow[]
  boards: Board[]
  cards: BoardCard[]
  runs: RunEvent[]
  recent: TreeEntry[]
  fileCount: number
  people: Person[]
}
