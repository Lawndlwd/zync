export type SearchResult = {
  name: string
  path: string
  size: number
  mtime: number
  score: number
  /** Matching lines, best first (1-based line numbers). */
  snippets: Array<{ line: number; text: string }>
}

export type TreeEntry = {
  name: string
  path: string
  type: 'dir' | 'file'
  size: number
  mtime: number
}

export type FileData = {
  path: string
  size: number
  mtime: number
  binary: boolean
  content: string | null
}
