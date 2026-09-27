export type MemoryScope = 'global' | 'workspace'

export const MEMORY_TYPES = ['rule', 'preference', 'habit', 'fact'] as const

export type MemoryType = (typeof MEMORY_TYPES)[number]

export type Memory = {
  file: string
  title: string
  scope: MemoryScope
  type?: MemoryType
  description?: string
  pinned: boolean
  updated: string
  body: string
}

export type MemoryPatch = {
  title?: string
  type?: MemoryType | null
  description?: string | null
  pinned?: boolean
  body?: string
}

export type MemoryFilter = 'all' | MemoryType

export type MemoryDraft = {
  scope: MemoryScope
  title: string
  type: MemoryType
  description: string
  pinned: boolean
  body: string
}
