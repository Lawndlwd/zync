import express, { Router } from 'express'

import { LibraryItemBody } from './body.js'
import { relPath } from './helpers/request.js'
import {
  createLibraryItem,
  deleteLibraryEntry,
  listLibrary,
  readLibraryFile,
  resetSkill,
  writeLibraryFile,
} from './opencode-library.js'

/** The AI's agents, commands and skills: markdown files in opencode's config folder (`configDir`). */
export function opencodeLibraryRoutes(
  configDir: string,
  /** zync's own skills (copied into the config folder at start-up), to compare and reset. */
  builtinSkillsDir?: string,
): Router {
  const r = Router()

  r.get('/library', async (_req, res) => {
    res.json({ dir: configDir, items: await listLibrary(configDir, builtinSkillsDir) })
  })

  r.post('/library', express.json(), async (req, res) => {
    const { kind, name, description } = LibraryItemBody.parse(req.body)
    const file = await createLibraryItem(configDir, kind, name, description)
    res.status(201).json({ path: file })
  })

  r.get('/files/*path', async (req, res) => {
    res.json(await readLibraryFile(configDir, relPath(req)))
  })

  r.put('/files/*path', express.text({ type: () => true, limit: '2mb' }), async (req, res) => {
    const base = req.get('x-base-mtime')
    // A 409 carries the file's current `mtime` (see the error handler).
    res.json(
      await writeLibraryFile(
        configDir,
        relPath(req),
        typeof req.body === 'string' ? req.body : '',
        base === undefined ? undefined : Number(base),
      ),
    )
  })

  r.delete('/files/*path', async (req, res) => {
    await deleteLibraryEntry(configDir, relPath(req))
    res.status(204).end()
  })

  r.post('/skills/:name/reset', async (req, res) => {
    await resetSkill(configDir, builtinSkillsDir, req.params.name)
    res.status(204).end()
  })

  return r
}
