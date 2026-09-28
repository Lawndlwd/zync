import express, { Router } from 'express'

import {
  ConnectionPatchBody,
  GoogleStartBody,
  SlackBody,
  TelegramCodeBody,
  TelegramPasswordBody,
  TelegramStartBody,
} from './body.js'
import type { Connections } from './connections/service.js'

const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

/** Settings → Connections: add, list, rename and remove accounts; read events for the calendar. */
export function connectionsRoutes(connections: Connections): Router {
  const r = Router()

  // Google sends the browser back here after its consent screen (a top-level visit from another
  // site, so without the session cookie: the one-time state proves it was started from the app).
  r.get('/google/callback', async (req, res) => {
    const { back, error } = await connections.googleFinish({
      code: str(req.query.code),
      state: str(req.query.state),
      error: str(req.query.error),
    })
    const q = new URLSearchParams(error ? { connectError: error } : { connected: 'google' })
    res.redirect(302, `${back}?${q}`)
  })

  r.use(express.json())

  r.get('/', async (_req, res) => {
    res.json({ connections: await connections.list(), available: connections.available() })
  })

  r.patch('/:id', async (req, res) => {
    res.json(await connections.rename(req.params.id, ConnectionPatchBody.parse(req.body).label))
  })

  r.delete('/:id', async (req, res) => {
    await connections.remove(req.params.id)
    res.status(204).end()
  })

  r.post('/google', async (req, res) => {
    res.json({ url: connections.googleStart(GoogleStartBody.parse(req.body).back) })
  })

  r.post('/slack', async (req, res) => {
    const body = SlackBody.parse(req.body)
    res.status(201).json(await connections.slackAdd(body.token, body.label))
  })

  r.post('/telegram/start', async (req, res) => {
    const body = TelegramStartBody.parse(req.body)
    res.json({ login: await connections.telegramStart(body.apiId, body.apiHash, body.phone) })
  })

  r.post('/telegram/code', async (req, res) => {
    const body = TelegramCodeBody.parse(req.body)
    const result = await connections.telegramCode(body.login, body.code)
    res.json(result === 'password' ? { password: true } : { connection: result })
  })

  r.post('/telegram/password', async (req, res) => {
    const body = TelegramPasswordBody.parse(req.body)
    res.json({ connection: await connections.telegramPassword(body.login, body.password) })
  })

  // Google Calendar events for the calendar view, read live (never stored).
  r.get('/events', async (req, res) => {
    res.json(await connections.events(str(req.query.from) ?? '', str(req.query.to) ?? ''))
  })

  return r
}
