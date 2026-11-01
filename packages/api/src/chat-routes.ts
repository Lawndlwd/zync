import { httpError, type OpencodeClient } from '@zync/jobs'
import { Router } from 'express'

import { wsOf } from './workspace-param.js'

// The docked chat. opencode v2's web UI only opens existing sessions (/server/…/session/<id>), so a
// workspace's first chat is created here, in the workspace folder; opencode names it.
export function chatRoutes(opencode?: OpencodeClient): Router {
  const r = Router({ mergeParams: true })

  r.post('/session', async (req, res) => {
    const ws = await wsOf(req)
    if (!opencode) throw httpError(503, 'The AI server is not configured')
    res.status(201).json({ id: await opencode.createSession(ws.path) })
  })

  return r
}
