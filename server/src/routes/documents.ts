import { Router } from 'express'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, statSync, existsSync } from 'fs'
import { join, basename, extname, relative } from 'path'
import { parseFrontmatter, serializeFrontmatter } from '../utils/frontmatter.js'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { FolderCreateSchema, FolderRenameSchema, DocumentCreateSchema, DocumentUpdateSchema, DocumentBulkSchema } from '../lib/schemas.js'

export const documentsRouter = Router()

function getDocsRoot(): string {
  const root = process.env.DOCUMENTS_PATH
  if (!root) throw new Error('DOCUMENTS_PATH env var is not set')
  mkdirSync(root, { recursive: true })
  return root
}

/** Prevent path traversal — resolve and verify the path stays inside root */
function safePath(root: string, ...segments: string[]): string {
  const resolved = join(root, ...segments)
  const rel = relative(root, resolved)
  if (rel.startsWith('..') || rel.includes('..')) {
    throw new Error('Invalid path')
  }
  return resolved
}

function getFileStat(filePath: string) {
  const stat = statSync(filePath)
  return {
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
  }
}

// ── Folders (directories) ──

documentsRouter.get('/folders', (_req, res) => {
  try {
    const root = getDocsRoot()
    const entries = readdirSync(root, { withFileTypes: true })
    const folders = entries
      .filter(e => e.isDirectory())
      .map(e => {
        const dirPath = join(root, e.name)
        const files = readdirSync(dirPath).filter(f => f.endsWith('.md'))
        const stat = statSync(dirPath)
        return {
          name: e.name,
          docCount: files.length,
          createdAt: stat.birthtime.toISOString(),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    res.json(folders)
  } catch (err) {
    errorResponse(res, err)
  }
})

documentsRouter.post('/folders', validate(FolderCreateSchema), (req, res) => {
  try {
    const root = getDocsRoot()
    const { name } = req.body
    const dirPath = safePath(root, name.trim())
    mkdirSync(dirPath, { recursive: true })
    res.json({ name: name.trim(), docCount: 0, createdAt: new Date().toISOString() })
  } catch (err) {
    errorResponse(res, err)
  }
})

documentsRouter.put('/folders/:name', validate(FolderRenameSchema), (req, res) => {
  try {
    const root = getDocsRoot()
    const { name: newName } = req.body
    const oldPath = safePath(root, req.params.name as string)
    const newPath = safePath(root, newName.trim())
    renameSync(oldPath, newPath)
    const files = readdirSync(newPath).filter(f => f.endsWith('.md'))
    res.json({ name: newName.trim(), docCount: files.length, createdAt: statSync(newPath).birthtime.toISOString() })
  } catch (err) {
    errorResponse(res, err)
  }
})

documentsRouter.delete('/folders/:name', (req, res) => {
  try {
    const root = getDocsRoot()
    const dirPath = safePath(root, req.params.name)
    rmSync(dirPath, { recursive: true, force: true })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Documents (markdown files) ──

documentsRouter.get('/', (req, res) => {
  try {
    const root = getDocsRoot()
    const folder = req.query.folder as string | undefined
    const results: Array<Record<string, unknown>> = []

    const scanFolder = (folderName: string) => {
      const dirPath = safePath(root, folderName)
      if (!existsSync(dirPath)) return
      const files = readdirSync(dirPath).filter(f => f.endsWith('.md'))
      for (const file of files) {
        const filePath = join(dirPath, file)
        const raw = readFileSync(filePath, 'utf-8')
        const { metadata, content } = parseFrontmatter(raw)
        const stat = getFileStat(filePath)
        results.push({
          path: `${folderName}/${file}`,
          folder: folderName,
          title: basename(file, '.md'),
          content,
          metadata,
          ...stat,
        })
      }
    }

    if (folder) {
      scanFolder(folder)
    } else {
      const dirs = readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory())
      for (const dir of dirs) {
        scanFolder(dir.name)
      }
    }

    results.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime())
    res.json(results)
  } catch (err) {
    errorResponse(res, err)
  }
})

/** GET a single document by path (folder/file.md) */
documentsRouter.get('/file/:path(*)', (req, res) => {
  try {
    const root = getDocsRoot()
    const docPath = (req.params as Record<string, string>).path
    const filePath = safePath(root, docPath)
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Document not found' })
      return
    }
    const raw = readFileSync(filePath, 'utf-8')
    const { metadata, content } = parseFrontmatter(raw)
    const stat = getFileStat(filePath)
    const parts = docPath.split('/')
    res.json({
      path: docPath,
      folder: parts.slice(0, -1).join('/'),
      title: basename(docPath, '.md'),
      content,
      metadata,
      ...stat,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

/** Create a new document */
documentsRouter.post('/', validate(DocumentCreateSchema), (req, res) => {
  try {
    const root = getDocsRoot()
    const { folder, title, content, metadata } = req.body
    const fileName = `${title.trim()}.md`
    const filePath = safePath(root, folder, fileName)
    mkdirSync(join(root, folder), { recursive: true })
    const bodyContent = content || ''
    const fileContent = metadata ? serializeFrontmatter(metadata, bodyContent) : bodyContent
    writeFileSync(filePath, fileContent, 'utf-8')
    const stat = getFileStat(filePath)
    res.json({
      path: `${folder}/${fileName}`,
      folder,
      title: title.trim(),
      content: bodyContent,
      metadata: metadata || {},
      ...stat,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

/** Update a document — path is the current path */
documentsRouter.put('/file/:path(*)', validate(DocumentUpdateSchema), (req, res) => {
  try {
    const root = getDocsRoot()
    const docPath = (req.params as Record<string, string>).path
    const filePath = safePath(root, docPath)
    const { title, content, folder: newFolder, metadata } = req.body

    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    // If title or folder changed, we need to move the file
    const oldFolder = docPath.split('/').slice(0, -1).join('/')
    const oldTitle = basename(docPath, '.md')
    const finalTitle = title?.trim() ?? oldTitle
    const finalFolder = newFolder ?? oldFolder
    const newFileName = `${finalTitle}.md`
    const newFilePath = safePath(root, finalFolder, newFileName)

    if (content !== undefined) {
      const fileContent = metadata ? serializeFrontmatter(metadata, content) : content
      writeFileSync(filePath, fileContent, 'utf-8')
    } else if (metadata) {
      // metadata changed but content not provided — read existing content and rewrite
      const existingRaw = readFileSync(filePath, 'utf-8')
      const parsed = parseFrontmatter(existingRaw)
      writeFileSync(filePath, serializeFrontmatter(metadata, parsed.content), 'utf-8')
    }

    if (newFilePath !== filePath) {
      mkdirSync(join(root, finalFolder), { recursive: true })
      renameSync(filePath, newFilePath)
    }

    const finalRaw = readFileSync(newFilePath, 'utf-8')
    const finalParsed = parseFrontmatter(finalRaw)
    const stat = getFileStat(newFilePath)
    res.json({
      path: `${finalFolder}/${newFileName}`,
      folder: finalFolder,
      title: finalTitle,
      content: finalParsed.content,
      metadata: finalParsed.metadata,
      ...stat,
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

/** Delete a document */
documentsRouter.delete('/file/:path(*)', (req, res) => {
  try {
    const root = getDocsRoot()
    const docPath = (req.params as Record<string, string>).path
    const filePath = safePath(root, docPath)
    rmSync(filePath, { force: true })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Bulk fetch for PR-Agent ──

documentsRouter.post('/bulk', validate(DocumentBulkSchema), (req, res) => {
  try {
    const root = getDocsRoot()
    const { paths } = req.body
    const docs = paths.map((p: string) => {
      const filePath = safePath(root, p)
      const raw = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
      const { metadata, content } = parseFrontmatter(raw)
      return {
        path: p,
        title: basename(p, '.md'),
        content,
        metadata,
      }
    })
    res.json(docs)
  } catch (err) {
    errorResponse(res, err)
  }
})
