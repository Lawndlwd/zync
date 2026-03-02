import { Router } from 'express'
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'
import { parseFrontmatter, serializeFrontmatter } from '../utils/frontmatter.js'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import { ProjectCreateSchema, ProjectUpdateSchema, TaskCreateSchema, TaskUpdateSchema } from '../lib/schemas.js'

export const projectsRouter = Router()

// ── Helper functions ──

function getProjectsRoot(): string {
  const docsPath = process.env.DOCUMENTS_PATH
  if (!docsPath) throw new Error('DOCUMENTS_PATH env var is not set')
  const root = join(docsPath, 'projects')
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function readTask(projectName: string, fileName: string, root: string) {
  const filePath = safePath(root, projectName, fileName)
  const raw = readFileSync(filePath, 'utf-8')
  const { metadata, content } = parseFrontmatter(raw)
  const stat = statSync(filePath)
  return {
    id: fileName.replace(/\.md$/, ''),
    fileName,
    project: projectName,
    metadata,
    content,
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
  }
}

// ── Routes ──

// 1. GET / — list all projects
projectsRouter.get('/', (_req, res) => {
  try {
    const root = getProjectsRoot()
    const entries = readdirSync(root, { withFileTypes: true })
    const projects = entries
      .filter(e => e.isDirectory())
      .map(e => {
        const dirPath = join(root, e.name)
        const readmePath = join(dirPath, 'README.md')
        let metadata: Record<string, any> = {}
        let content = ''
        if (existsSync(readmePath)) {
          const raw = readFileSync(readmePath, 'utf-8')
          const parsed = parseFrontmatter(raw)
          metadata = parsed.metadata
          content = parsed.content
        }
        const files = readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== 'README.md')
        const stat = statSync(dirPath)
        return {
          name: e.name,
          metadata,
          content,
          taskCount: files.length,
          createdAt: stat.birthtime.toISOString(),
        }
      })
    res.json(projects)
  } catch (err) {
    errorResponse(res, err)
  }
})

// 2. POST / — create project
projectsRouter.post('/', validate(ProjectCreateSchema), (req, res) => {
  try {
    const root = getProjectsRoot()
    const { name, metadata, content } = req.body
    const slug = slugify(name)
    const dirPath = safePath(root, slug)
    if (existsSync(dirPath)) {
      res.status(409).json({ error: 'Project already exists' })
      return
    }
    mkdirSync(dirPath, { recursive: true })
    const today = new Date().toISOString().slice(0, 10)
    const defaultMetadata = {
      title: name.trim(),
      description: '',
      tags: [],
      color: 'indigo',
      icon: 'folder',
      created: today,
      ...metadata,
    }
    const body = content || ''
    writeFileSync(join(dirPath, 'README.md'), serializeFrontmatter(defaultMetadata, body), 'utf-8')
    res.json({
      name: slug,
      metadata: defaultMetadata,
      content: body,
      taskCount: 0,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// 3. GET /all-tasks — all tasks across all projects (MUST be before /:name)
projectsRouter.get('/all-tasks', (_req, res) => {
  try {
    const root = getProjectsRoot()
    const tasks: Array<Record<string, unknown>> = []
    const entries = readdirSync(root, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dirPath = join(root, entry.name)
      const files = readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== 'README.md')
      for (const file of files) {
        try {
          tasks.push(readTask(entry.name, file, root))
        } catch {
          // skip unreadable files
        }
      }
    }
    tasks.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime())
    res.json(tasks)
  } catch (err) {
    errorResponse(res, err)
  }
})

// 4. GET /:name — get project details
projectsRouter.get('/:name', (req, res) => {
  try {
    const root = getProjectsRoot()
    const dirPath = safePath(root, req.params.name)
    if (!existsSync(dirPath)) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const readmePath = join(dirPath, 'README.md')
    let metadata: Record<string, any> = {}
    let content = ''
    if (existsSync(readmePath)) {
      const raw = readFileSync(readmePath, 'utf-8')
      const parsed = parseFrontmatter(raw)
      metadata = parsed.metadata
      content = parsed.content
    }
    const files = readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== 'README.md')
    const stat = statSync(dirPath)
    res.json({
      name: req.params.name,
      metadata,
      content,
      taskCount: files.length,
      createdAt: stat.birthtime.toISOString(),
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// 5. PUT /:name — update project
projectsRouter.put('/:name', validate(ProjectUpdateSchema), (req, res) => {
  try {
    const root = getProjectsRoot()
    const dirPath = safePath(root, req.params.name as string)
    if (!existsSync(dirPath)) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const { metadata, content, newName } = req.body
    const readmePath = join(dirPath, 'README.md')

    // Read existing README
    let existingMetadata: Record<string, any> = {}
    let existingContent = ''
    if (existsSync(readmePath)) {
      const raw = readFileSync(readmePath, 'utf-8')
      const parsed = parseFrontmatter(raw)
      existingMetadata = parsed.metadata
      existingContent = parsed.content
    }

    const finalMetadata = metadata ? { ...existingMetadata, ...metadata } : existingMetadata
    const finalContent = content !== undefined ? content : existingContent
    writeFileSync(readmePath, serializeFrontmatter(finalMetadata, finalContent), 'utf-8')

    let finalName = req.params.name as string
    if (newName) {
      const newSlug = slugify(newName)
      const newDirPath = safePath(root, newSlug)
      if (newDirPath !== dirPath) {
        renameSync(dirPath, newDirPath)
        finalName = newSlug
      }
    }

    const finalDirPath = safePath(root, finalName)
    const files = readdirSync(finalDirPath).filter(f => f.endsWith('.md') && f !== 'README.md')
    const stat = statSync(finalDirPath)
    res.json({
      name: finalName,
      metadata: finalMetadata,
      content: finalContent,
      taskCount: files.length,
      createdAt: stat.birthtime.toISOString(),
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// 6. DELETE /:name — delete project + all tasks
projectsRouter.delete('/:name', (req, res) => {
  try {
    const root = getProjectsRoot()
    const dirPath = safePath(root, req.params.name)
    if (!existsSync(dirPath)) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    rmSync(dirPath, { recursive: true, force: true })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// 7. GET /:name/tasks — get tasks for a project
projectsRouter.get('/:name/tasks', (req, res) => {
  try {
    const root = getProjectsRoot()
    const dirPath = safePath(root, req.params.name)
    if (!existsSync(dirPath)) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const files = readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== 'README.md')
    const tasks = files.map(f => readTask(req.params.name, f, root))
    tasks.sort((a, b) => new Date(b.updatedAt as string).getTime() - new Date(a.updatedAt as string).getTime())
    res.json(tasks)
  } catch (err) {
    errorResponse(res, err)
  }
})

// 8. POST /:name/tasks — create task
projectsRouter.post('/:name/tasks', validate(TaskCreateSchema), (req, res) => {
  try {
    const root = getProjectsRoot()
    const name = req.params.name as string
    const dirPath = safePath(root, name)
    if (!existsSync(dirPath)) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    const { title, metadata, content } = req.body
    const slug = slugify(title)
    const fileName = `${slug}.md`
    const filePath = safePath(root, name, fileName)
    if (existsSync(filePath)) {
      res.status(409).json({ error: 'Task already exists' })
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const defaultMetadata = {
      title: title.trim(),
      status: 'todo',
      assignee: '@me',
      priority: 'medium',
      tags: [],
      created: today,
      updated: today,
      ...metadata,
    }
    const body = content || ''
    writeFileSync(filePath, serializeFrontmatter(defaultMetadata, body), 'utf-8')
    const stat = statSync(filePath)
    res.json({
      id: slug,
      fileName,
      project: name,
      metadata: defaultMetadata,
      content: body,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// 9. PUT /:name/tasks/:taskFile — update task
projectsRouter.put('/:name/tasks/:taskFile', validate(TaskUpdateSchema), (req, res) => {
  try {
    const root = getProjectsRoot()
    const paramName = req.params.name as string
    const paramTaskFile = req.params.taskFile as string
    const taskFile = paramTaskFile.endsWith('.md') ? paramTaskFile : `${paramTaskFile}.md`
    const filePath = safePath(root, paramName, taskFile)
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    const { metadata, content } = req.body

    // Read existing
    const raw = readFileSync(filePath, 'utf-8')
    const parsed = parseFrontmatter(raw)

    const today = new Date().toISOString().slice(0, 10)
    const finalMetadata = metadata
      ? { ...parsed.metadata, ...metadata, updated: today }
      : { ...parsed.metadata, updated: today }
    const finalContent = content !== undefined ? content : parsed.content

    writeFileSync(filePath, serializeFrontmatter(finalMetadata, finalContent), 'utf-8')
    const stat = statSync(filePath)
    res.json({
      id: taskFile.replace(/\.md$/, ''),
      fileName: taskFile,
      project: paramName,
      metadata: finalMetadata,
      content: finalContent,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// 10. PATCH /:name/tasks/:taskFile/status — quick status update
projectsRouter.patch('/:name/tasks/:taskFile/status', (req, res) => {
  try {
    const root = getProjectsRoot()
    const taskFile = req.params.taskFile.endsWith('.md') ? req.params.taskFile : `${req.params.taskFile}.md`
    const filePath = safePath(root, req.params.name, taskFile)
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    const { status } = req.body
    const validStatuses = ['todo', 'in-progress', 'completed']
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` })
      return
    }

    const raw = readFileSync(filePath, 'utf-8')
    const parsed = parseFrontmatter(raw)
    const today = new Date().toISOString().slice(0, 10)
    const finalMetadata = { ...parsed.metadata, status, updated: today }

    writeFileSync(filePath, serializeFrontmatter(finalMetadata, parsed.content), 'utf-8')
    const stat = statSync(filePath)
    res.json({
      id: taskFile.replace(/\.md$/, ''),
      fileName: taskFile,
      project: req.params.name,
      metadata: finalMetadata,
      content: parsed.content,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    })
  } catch (err) {
    errorResponse(res, err)
  }
})

// 11. DELETE /:name/tasks/:taskFile — delete task
projectsRouter.delete('/:name/tasks/:taskFile', (req, res) => {
  try {
    const root = getProjectsRoot()
    const taskFile = req.params.taskFile.endsWith('.md') ? req.params.taskFile : `${req.params.taskFile}.md`
    const filePath = safePath(root, req.params.name, taskFile)
    if (!existsSync(filePath)) {
      res.status(404).json({ error: 'Task not found' })
      return
    }
    rmSync(filePath, { force: true })
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})
