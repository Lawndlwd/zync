import { z } from 'zod'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs'
import { join, basename, relative } from 'path'

function getDocsRoot(): string {
  const root = process.env.DOCUMENTS_PATH
  if (!root) throw new Error('DOCUMENTS_PATH env var is not set')
  mkdirSync(root, { recursive: true })
  return root
}

function safePath(root: string, ...segments: string[]): string {
  const resolved = join(root, ...segments)
  const rel = relative(root, resolved)
  if (rel.startsWith('..') || rel.includes('..')) {
    throw new Error('Invalid path')
  }
  return resolved
}

// --- Tools ---

export const listDocumentsSchema = z.object({
  folder: z.string().optional().describe('Folder name to filter by. Omit for all folders.'),
})

export async function listDocuments(input: z.infer<typeof listDocumentsSchema>) {
  const root = getDocsRoot()
  const results: any[] = []

  const scanFolder = (folderName: string) => {
    const dirPath = safePath(root, folderName)
    if (!existsSync(dirPath)) return
    const files = readdirSync(dirPath).filter((f) => f.endsWith('.md'))
    for (const file of files) {
      const filePath = join(dirPath, file)
      const stat = statSync(filePath)
      results.push({
        path: `${folderName}/${file}`,
        folder: folderName,
        title: basename(file, '.md'),
        updatedAt: stat.mtime.toISOString(),
      })
    }
  }

  if (input.folder) {
    scanFolder(input.folder)
  } else {
    const dirs = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory())
    for (const dir of dirs) {
      scanFolder(dir.name)
    }
  }

  results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return JSON.stringify(results)
}

export const getDocumentSchema = z.object({
  path: z.string().describe('Document path (folder/filename.md)'),
})

export async function getDocument(input: z.infer<typeof getDocumentSchema>) {
  const root = getDocsRoot()
  const filePath = safePath(root, input.path)
  if (!existsSync(filePath)) {
    return JSON.stringify({ error: 'Document not found' })
  }
  const content = readFileSync(filePath, 'utf-8')
  const stat = statSync(filePath)
  const parts = input.path.split('/')
  return JSON.stringify({
    path: input.path,
    folder: parts.slice(0, -1).join('/'),
    title: basename(input.path, '.md'),
    content,
    updatedAt: stat.mtime.toISOString(),
  })
}

export const createDocumentSchema = z.object({
  folder: z.string().describe('Folder to create the document in'),
  title: z.string().describe('Document title (used as filename)'),
  content: z.string().default('').describe('Document content (markdown)'),
})

export async function createDocument(input: z.infer<typeof createDocumentSchema>) {
  const root = getDocsRoot()
  const fileName = `${input.title.trim()}.md`
  const filePath = safePath(root, input.folder, fileName)
  mkdirSync(join(root, input.folder), { recursive: true })
  writeFileSync(filePath, input.content, 'utf-8')
  return JSON.stringify({
    path: `${input.folder}/${fileName}`,
    folder: input.folder,
    title: input.title.trim(),
  })
}

export const updateDocumentSchema = z.object({
  path: z.string().describe('Document path (folder/filename.md)'),
  content: z.string().optional().describe('New content (markdown)'),
  title: z.string().optional().describe('New title (will rename file)'),
})

export async function updateDocument(input: z.infer<typeof updateDocumentSchema>) {
  const root = getDocsRoot()
  const filePath = safePath(root, input.path)
  if (!existsSync(filePath)) {
    return JSON.stringify({ error: 'Document not found' })
  }

  if (input.content !== undefined) {
    writeFileSync(filePath, input.content, 'utf-8')
  }

  if (input.title) {
    const { renameSync } = await import('fs')
    const parts = input.path.split('/')
    const folder = parts.slice(0, -1).join('/')
    const newFileName = `${input.title.trim()}.md`
    const newPath = safePath(root, folder, newFileName)
    if (newPath !== filePath) {
      renameSync(filePath, newPath)
    }
    return JSON.stringify({ path: `${folder}/${newFileName}`, title: input.title.trim() })
  }

  return JSON.stringify({ path: input.path, success: true })
}
