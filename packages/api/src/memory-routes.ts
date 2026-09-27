import {
  buildMemoryPrompt,
  createMemory,
  deleteMemory,
  globalMemoryDir,
  listMemories,
  type MemoryScope,
  readPersonNotes,
  updateMemory,
  workspaceMemoryDir,
  writePersonNotes,
} from '@zync/jobs'
import express, { type Request, Router } from 'express'

import { MemoryBody, MemoryPatchBody, PersonNotesBody } from './body.js'
import { wsOf } from './workspace-param.js'

/** The AI's memory: `/memory` (global) and `/ws/:ws/memory` (one workspace). `:file` is `<title>.md`. */
function memoryRouter(scope: MemoryScope, dirOf: (req: Request) => Promise<string>): Router {
  const r = Router({ mergeParams: true })
  r.use(express.json({ limit: '1mb' }))

  r.get('/', async (req, res) => {
    res.json(await listMemories(await dirOf(req), scope))
  })

  r.post('/', async (req, res) => {
    res.status(201).json(await createMemory(await dirOf(req), scope, MemoryBody.parse(req.body)))
  })

  r.patch('/:file', async (req, res) => {
    res.json(await updateMemory(await dirOf(req), scope, req.params.file, MemoryPatchBody.parse(req.body)))
  })

  r.delete('/:file', async (req, res) => {
    await deleteMemory(await dirOf(req), req.params.file)
    res.status(204).end()
  })

  return r
}

export function globalMemoryRoutes(root: string): Router {
  return memoryRouter('global', async () => globalMemoryDir(root))
}

export function workspaceMemoryRoutes(root: string): Router {
  const r = Router({ mergeParams: true })
  // Exactly what the AI gets in its system prompt when chatting in this workspace.
  r.get('/prompt', async (req, res) => {
    const ws = await wsOf(req)
    res.json({ text: await buildMemoryPrompt({ root, wsPath: ws.path }) })
  })
  r.use(memoryRouter('workspace', async (req) => workspaceMemoryDir((await wsOf(req)).path)))
  return r
}

/** `/people/:id/notes`: what the AI knows about someone (a markdown page). */
export function personNotesRoutes(root: string): Router {
  const r = Router({ mergeParams: true })
  r.use(express.json({ limit: '1mb' }))
  r.get('/:id/notes', async (req, res) => {
    res.json({ notes: await readPersonNotes(req.params.id, root) })
  })
  r.put('/:id/notes', async (req, res) => {
    res.json({ notes: await writePersonNotes(req.params.id, PersonNotesBody.parse(req.body).notes, root) })
  })
  return r
}
