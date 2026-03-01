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
  createdAt: string
  updatedAt: string
}
