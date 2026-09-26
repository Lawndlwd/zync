import { existsSync } from 'node:fs'
import path from 'node:path'
import { createWorkspace, defaultTimezone, errorMessage, listWorkspaces, OpencodeClient } from '@zync/jobs'
import express, { type NextFunction, type Request, type Response } from 'express'
import { boardsRoutes, peopleRoutes } from './boards-routes.js'
import { eventsHandler } from './events.js'
import { fsRoutes } from './fs-routes.js'
import { jobsRoutes } from './jobs-routes.js'
import { opencodeRoutes } from './opencode-routes.js'

export interface AppOptions {
  workspacesRoot: string
  chatUrl?: string
  webDist?: string
  /** The opencode config file editable from Settings. */
  opencodeConfigPath?: string
  opencodeClient?: OpencodeClient
}

export function createApp(opts: AppOptions) {
  const app = express()
  app.disable('x-powered-by')
  app.set('workspacesRoot', opts.workspacesRoot)

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/config', (_req, res) => {
    res.json({ chatUrl: opts.chatUrl || null, workspacesRoot: opts.workspacesRoot, timezone: defaultTimezone() })
  })

  app.get('/api/workspaces', async (_req, res) => {
    res.json(await listWorkspaces(opts.workspacesRoot))
  })

  app.post('/api/workspaces', express.json(), async (req, res) => {
    res.status(201).json(await createWorkspace(String(req.body?.name || '').trim(), opts.workspacesRoot))
  })

  app.use('/api/people', peopleRoutes(opts.workspacesRoot))
  app.use('/api/ws/:ws/boards', boardsRoutes())
  app.use('/api/ws/:ws', fsRoutes())
  app.use('/api/ws/:ws/jobs', jobsRoutes())
  app.get('/api/ws/:ws/events', eventsHandler)
  if (opts.opencodeConfigPath) app.use('/api/opencode', opencodeRoutes(opts.opencodeConfigPath, opts.opencodeClient))

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  if (opts.webDist && existsSync(opts.webDist)) {
    app.use(express.static(opts.webDist, { index: false }))
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(opts.webDist as string, 'index.html'))
    })
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const invalid = err?.name === 'ZodError'
    const status =
      (invalid && 400) ||
      err.status ||
      err.statusCode ||
      (err.code === 'ENOENT' ? 404 : err.code === 'EEXIST' ? 409 : err.code === 'ENOTDIR' ? 400 : 500)
    if (status >= 500) console.error(err)
    res.status(status).json({ error: (invalid ? errorMessage(err) : err.message) || 'Internal error' })
  })

  return app
}
