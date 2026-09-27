import type { Column } from '../types/boards'

export const PRESETS: Record<string, Column[]> = {
  standard: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'todo', name: 'To do' },
    { id: 'doing', name: 'In progress' },
    { id: 'review', name: 'Review' },
    { id: 'done', name: 'Done' },
  ],
  simple: [
    { id: 'todo', name: 'To do' },
    { id: 'doing', name: 'In progress' },
    { id: 'done', name: 'Done' },
  ],
  personal: [
    { id: 'backlog', name: 'Ideas' },
    { id: 'todo', name: 'This week' },
    { id: 'review', name: 'Waiting' },
    { id: 'done', name: 'Done' },
  ],
}

export const presetLabel = (k: string) => (PRESETS[k] ?? []).map((c) => c.name).join(' · ')
