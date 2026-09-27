export type RunRecord = {
  ts: string
  sessionId?: string
  status: 'ok' | 'failed' | 'timeout' | 'skipped'
  durationMs?: number
  summary: string
  trigger: 'schedule' | 'manual'
}

export type JobRow = {
  name: string
  error?: string
  job?: {
    name: string
    schedule?: string
    at?: string
    /** Workspace-relative card file when the job belongs to a board card. */
    card?: string
    timezone?: string
    agent?: string
    model?: string
    context: string[]
    notify: string
    enabled: boolean
    instructions: string
  }
  nextRuns: string[]
  lastRun: RunRecord | null
}
