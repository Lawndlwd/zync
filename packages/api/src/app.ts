import { existsSync } from 'node:fs'
import path from 'node:path'

import { createWorkspace, defaultTimezone, listWorkspaces, type OpencodeClient } from '@zync/jobs'
import express from 'express'

import { guard } from './auth/guard.js'
import { pageCsp, securityHeaders } from './auth/headers.js'
import { authRoutes } from './auth/routes.js'
import type { Auth } from './auth/service.js'
import { boardsRoutes } from './boards-routes.js'
import { WorkspaceBody } from './body.js'
import { calendarRoutes } from './calendar-routes.js'
import { eventsHandler } from './events.js'
import { fsRoutes } from './fs-routes.js'
import { jobsRoutes } from './jobs-routes.js'
import { globalMemoryRoutes, personNotesRoutes, workspaceMemoryRoutes } from './memory-routes.js'
import { errorHandler } from './middleware/error-handler.js'
import { opencodeProxy } from './opencode-proxy.js'
import { opencodeRoutes, type RestartTiming } from './opencode-routes.js'
import { peopleRoutes } from './people-routes.js'
import { appFallback } from './spa.js'

/** zync's own REST API. Namespaced so the root stays free for opencode's UI (see opencode-proxy). */
const API = '/zync/api'

export type AppOptions = {
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
  /**
   * Sign-in and the request guard. Without it every request is let through: only for tests and
   * `ZYNC_INSECURE_DEV` on localhost (see index.ts).
   */
  auth?: Auth
}

export function createApp(opts: AppOptions) {
  const app = express()
  app.disable('x-powered-by')
  app.set('workspacesRoot', opts.workspacesRoot)
  const { auth } = opts
  if (auth) {
    // First, before any route: nothing is served to a request that doesn't pass the guard.
    app.use(securityHeaders(auth.cfg.origin.startsWith('https:')))
    app.use(guard(auth))
    app.use(`${API}/auth`, authRoutes(auth))
  }

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
    res.status(201).json(await createWorkspace(WorkspaceBody.parse(req.body).name, opts.workspacesRoot))
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

  const csp = auth && web ? pageCsp(path.join(web, 'index.html')) : undefined
  app.use(appFallback(web, proxy, csp))
  app.use(errorHandler)

  return app
}
