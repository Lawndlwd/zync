export interface JournalEntry {
  id: string
  date: string
  content: string
  linkedIssues: string[]
  completedTodos: string[]
  createdAt: string
  updatedAt: string
}
