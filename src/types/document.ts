export interface DocFolder {
  name: string
  docCount: number
  createdAt: string
}

export interface Document {
  path: string
  folder: string
  title: string
  content: string
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
}
