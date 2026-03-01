export type TodoPriority = 'P1' | 'P2' | 'P3' | 'P4'
export type TodoStatus = 'open' | 'in-progress' | 'done'

export interface Todo {
  id: string
  title: string
  description: string
  linkedIssue: string | null
  priority: TodoPriority
  dueDate: string | null
  status: TodoStatus
  createdAt: string
  updatedAt: string
  order: number
}
