import { calendarRange, createEvent, deleteEvent, readEvent, updateEvent } from '@zync/jobs'
import express, { Router } from 'express'
import { wsOf } from './workspace-param.js'

/** Calendar: everything with a time in a date range, plus CRUD for event pages in Calendar/. */
export function calendarRoutes(): Router {
  const r = Router({ mergeParams: true })
  r.use(express.json())

  r.get('/', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await calendarRange(ws.path, String(req.query.from || ''), String(req.query.to || '')))
  })

  r.post('/events', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await createEvent(ws.path, req.body ?? {}))
  })

  r.get('/events/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readEvent(ws.path, req.params.file))
  })

  r.patch('/events/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await updateEvent(ws.path, req.params.file, req.body ?? {}))
  })

  r.delete('/events/:file', async (req, res) => {
    const ws = await wsOf(req)
    await deleteEvent(ws.path, req.params.file)
    res.status(204).end()
  })

  return r
}
