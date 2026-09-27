import path from 'node:path'

import { OpencodeClient } from '@zync/jobs'
import { Router } from 'express'

import { opencodeConfigRoutes, type RestartTiming } from './opencode-config-routes.js'
import { opencodeLibraryRoutes } from './opencode-library-routes.js'

export type { RestartTiming } from './opencode-config-routes.js'

/** Everything under /opencode: the AI's library (agents, commands, skills) and its config file. */
export function opencodeRoutes(
  configPath: string,
  client = new OpencodeClient(),
  timing: RestartTiming = { pollMs: 250, downMs: 6000, upMs: 60_000 },
  /** zync's own skills (copied into the config folder at start-up), to compare and reset. */
  builtinSkillsDir?: string,
): Router {
  const r = Router()
  r.use(opencodeLibraryRoutes(path.dirname(configPath), builtinSkillsDir))
  r.use(opencodeConfigRoutes(configPath, client, timing))
  return r
}
