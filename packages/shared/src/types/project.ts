export type TaskStatus = 'todo' | 'in-progress' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high'
export type TaskAssignee = '@me' | '@ai'

export interface ProjectMetadata {
  title: string
  description: string
  tags: string[]
  color: string
  icon: string
  created: string
  [key: string]: any
}

export interface Project {
  name: string
  metadata: ProjectMetadata
  content: string
  taskCount: number
  createdAt: string
}

export interface TaskMetadata {
  title: string
  status: TaskStatus
  assignee: TaskAssignee
  priority: TaskPriority
  tags: string[]
  created: string
  updated: string
  [key: string]: any
}

export interface Task {
  id: string
  fileName: string
  project: string
  metadata: TaskMetadata
  content: string
  createdAt: string
  updatedAt: string
}
