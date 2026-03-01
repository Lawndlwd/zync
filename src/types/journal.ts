import type { JSONContent } from '@tiptap/react'

export interface JournalEntry {
  id: string
  date: string
  content: JSONContent
  linkedIssues: string[]
  completedTodos: string[]
  createdAt: string
  updatedAt: string
}
