export interface DocFolder {
  name: string
  label?: string
  docCount: number
  createdAt: string
  system?: boolean
}

export interface Document {
  path: string
  folder: string
  title: string
  content: string
  metadata: Record<string, any>
  createdAt: string
  updatedAt: string
  system?: boolean
}
