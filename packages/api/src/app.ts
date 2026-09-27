import { existsSync } from 'node:fs'
import path from 'node:path'
import { createWorkspace, defaultTimezone, errorMessage, listWorkspaces, type OpencodeClient } from '@zync/jobs'
import express, { type NextFunction, type Request, type Response } from 'express'
import { boardsRoutes, peopleRoutes } from './boards-routes.js'
import { calendarRoutes } from './calendar-routes.js'
import { eventsHandler } from './events.js'
import { fsRoutes } from './fs-routes.js'
import { jobsRoutes } from './jobs-routes.js'
import { globalMemoryRoutes, personNotesRoutes, workspaceMemoryRoutes } from './memory-routes.js'
import { opencodeProxy } from './opencode-proxy.js'
import { opencodeRoutes, type RestartTiming } from './opencode-routes.js'

/** zync's own REST API. Namespaced so the root stays free for opencode's UI (see opencode-proxy). */
const API = '/zync/api'

/** Paths the app serves itself; everything else belongs to opencode when the proxy is on. */
export const isAppPath = (url: string) => {
  const p = url.split('?')[0]
  return p === '/' || p.startsWith('/zync/') || p === '/w' || p.startsWith('/w/')
}

export interface AppOptions {
  workspacesRoot: string
  webDist?: string
  /** Forward opencode's web UI and API through this app (internal URL, e.g. http://opencode:4096). */
  opencodeUrl?: string
  /** The opencode config file editable from Settings. */
  opencodeConfigPath?: string
  opencodeClient?: OpencodeClient
  restartTiming?: RestartTiming
  /** zync's own opencode skills (opencode/skills), copied into the config folder at start-up. */
  opencodeSkillsDir?: string
}

export function createApp(opts: AppOptions) {
  const app = express()
  app.disable('x-powered-by')
  app.set('workspacesRoot', opts.workspacesRoot)

  app.get(`${API}/health`, (_req, res) => {
    res.json({ ok: true })
  })

  app.get(`${API}/config`, (_req, res) => {
    res.json({ workspacesRoot: opts.workspacesRoot, timezone: defaultTimezone() })
  })

  app.get(`${API}/workspaces`, async (_req, res) => {
    res.json(await listWorkspaces(opts.workspacesRoot))
  })

  app.post(`${API}/workspaces`, express.json(), async (req, res) => {
    res.status(201).json(await createWorkspace(String(req.body?.name || '').trim(), opts.workspacesRoot))
  })

  app.use(`${API}/people`, peopleRoutes(opts.workspacesRoot))
  app.use(`${API}/people`, personNotesRoutes(opts.workspacesRoot))
  app.use(`${API}/memory`, globalMemoryRoutes(opts.workspacesRoot))
  app.use(`${API}/ws/:ws/memory`, workspaceMemoryRoutes(opts.workspacesRoot))
  app.use(`${API}/ws/:ws/boards`, boardsRoutes())
  app.use(`${API}/ws/:ws/calendar`, calendarRoutes())
  app.use(`${API}/ws/:ws`, fsRoutes())
  app.use(`${API}/ws/:ws/jobs`, jobsRoutes())
  app.get(`${API}/ws/:ws/events`, eventsHandler)
  if (opts.opencodeConfigPath)
    app.use(
      `${API}/opencode`,
      opencodeRoutes(opts.opencodeConfigPath, opts.opencodeClient, opts.restartTiming, opts.opencodeSkillsDir),
    )

  app.use(API, (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  const web = opts.webDist && existsSync(opts.webDist) ? opts.webDist : null
  const proxy = opts.opencodeUrl ? opencodeProxy(opts.opencodeUrl) : null
  if (web) app.use('/zync/assets', express.static(path.join(web, 'zync/assets'), { immutable: true, maxAge: '1y' }))

  app.use((req, res, next) => {
    // opencode's own home page, when navigated to inside the chat frame.
    const inFrame = req.get('sec-fetch-dest') === 'iframe'
    const spa = req.path === '/' || req.path === '/w' || req.path.startsWith('/w/')
    if (web && req.method === 'GET' && spa && !(inFrame && req.path === '/')) {
      res.sendFile(path.join(web, 'index.html'))
      return
    }
    if (proxy && !(req.path.startsWith('/zync/') || req.path === '/w' || req.path.startsWith('/w/'))) {
      proxy(req, res)
      return
    }
    next()
  })

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
