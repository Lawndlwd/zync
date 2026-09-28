import { createHash, timingSafeEqual } from 'node:crypto'

import express, { type NextFunction, type Request, type Response } from 'express'

import type { Connections } from './connections/service.js'
import { errorHandler } from './middleware/error-handler.js'

// The api's internal side: what the product's AI reads through its MCP tools (packages/jobs
// connections/client.ts). A separate app on its own port (ZYNC_INTERNAL_PORT, 3002), reachable
// only on the compose network: the Cloudflare tunnel points at the public port, never this one.
// Every request carries ZYNC_INTERNAL_TOKEN. Read-only: nothing here writes to any service.

const digest = (s: string) => createHash('sha256').update(s).digest()

/** Constant-time check of the bearer token (hashing first makes the lengths equal). */
function bearer(token: string) {
  const expected = digest(token)
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = req.get('authorization') ?? ''
    const given = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (given && timingSafeEqual(digest(given), expected)) {
      next()
      return
    }
    res.status(401).json({ error: 'Unauthorized' })
  }
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

export function internalApp(connections: Connections, token: string) {
  const app = express()
  app.disable('x-powered-by')
  app.use(bearer(token))

  app.get('/internal/connections', async (_req, res) => {
    res.json(await connections.list())
  })

  app.get('/internal/mail', async (req, res) => {
    const limit = Number(req.query.limit)
    res.json(
      await connections.mail({
        since: str(req.query.since),
        query: str(req.query.query),
        connection: str(req.query.connection),
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    )
  })

  app.get('/internal/mail/:connection/:id', async (req, res) => {
    res.json(await connections.readMail(req.params.connection, req.params.id))
  })

  app.get('/internal/events', async (req, res) => {
    res.json(await connections.events(str(req.query.from) ?? '', str(req.query.to) ?? ''))
  })

  app.get('/internal/messages', async (req, res) => {
    const provider = req.query.provider
    res.json(
      await connections.messages({
        since: str(req.query.since),
        provider: provider === 'slack' || provider === 'telegram' ? provider : undefined,
        connection: str(req.query.connection),
      }),
    )
  })

  app.get('/internal/chats', async (req, res) => {
    res.json(await connections.chats(str(req.query.connection)))
  })

  app.get('/internal/chats/:connection/:chat', async (req, res) => {
    const limit = Number(req.query.limit)
    res.json(
      await connections.readChat(req.params.connection, req.params.chat, Number.isFinite(limit) ? limit : undefined),
    )
  })

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })
  app.use(errorHandler)
  return app
}
