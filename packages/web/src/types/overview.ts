export type Range = 'today' | 'week'

export type Slot = {
  key: string
  time: Date
  kind: 'job' | 'card'
  title: string
  state: 'ok' | 'failed' | 'timeout' | 'skipped' | 'running' | 'next' | 'planned'
}
