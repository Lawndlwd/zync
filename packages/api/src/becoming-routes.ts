import {
  addDays,
  answerQuestion,
  applyChange,
  badRequest,
  becomingWeek,
  enableMirrorJob,
  isoWeek,
  listMirrors,
  readMirror,
  weekMonday,
  becomingSlots,
  becomingToday,
  type Busy,
  castVote,
  createIdentity,
  deleteIdentity,
  httpError,
  INTERVIEW_PROMPT,
  listIdentities,
  localStamp,
  type OpencodeClient,
  readIdentity,
  updateIdentity,
} from '@zync/jobs'
import express, { Router } from 'express'

import { IdentityBody, IdentityPatchBody, MirrorAnswerBody, VoteBody } from './body.js'
import type { Connections } from './connections/service.js'
import { wsOf } from './workspace-param.js'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayOf = (v: unknown, fallback: string) => (typeof v === 'string' && DAY.test(v) ? v : fallback)

/** Becoming: identity pages in Becoming/, their votes, and the day as seen through them. */
export function becomingRoutes(connections?: Connections, opencode?: OpencodeClient): Router {
  const r = Router({ mergeParams: true })
  r.use(express.json())

  /** Timed events of the connected calendars; none when there are no connections or they fail. */
  const external = async (from: string, to: string): Promise<Busy[]> => {
    if (!connections) return []
    const found = await connections.events(from, to).catch(() => null)
    return (found?.items ?? []).filter((e) => !e.allDay).map((e) => ({ title: e.title, start: e.start, end: e.end }))
  }

  r.get('/today', async (req, res) => {
    const ws = await wsOf(req)
    const now = localStamp()
    const date = dayOf(req.query.date, now.slice(0, 10))
    res.json(await becomingToday(ws.path, date, await external(addDays(date, -1), addDays(date, 1)), now))
  })

  // Where each identity lands on the calendar, day by day: [from, to).
  r.get('/slots', async (req, res) => {
    const ws = await wsOf(req)
    const from = dayOf(req.query.from, localStamp().slice(0, 10))
    const to = dayOf(req.query.to, addDays(from, 7))
    res.json(await becomingSlots(ws.path, from, to, await external(from, to)))
  })

  r.get('/identities', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await listIdentities(ws.path))
  })

  r.post('/identities', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await createIdentity(ws.path, IdentityBody.parse(req.body)))
  })

  r.get('/identities/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readIdentity(ws.path, req.params.file))
  })

  r.patch('/identities/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await updateIdentity(ws.path, req.params.file, IdentityPatchBody.parse(req.body)))
  })

  r.delete('/identities/:file', async (req, res) => {
    const ws = await wsOf(req)
    await deleteIdentity(ws.path, req.params.file)
    res.status(204).end()
  })

  r.post('/identities/:file/votes', async (req, res) => {
    const ws = await wsOf(req)
    const body = VoteBody.parse(req.body)
    const date = body.date ?? localStamp().slice(0, 10)
    res.status(201).json(await castVote(ws.path, req.params.file, date, body.kind, body.source ?? 'tap'))
  })

  r.get('/week', async (req, res) => {
    const ws = await wsOf(req)
    const week = typeof req.query.week === 'string' ? req.query.week : isoWeek(localStamp().slice(0, 10))
    const monday = weekMonday(week)
    if (!monday) throw badRequest('week must look like 2026-W39')
    res.json(await becomingWeek(ws.path, week, await external(monday, addDays(monday, 7))))
  })

  r.get('/mirrors', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await listMirrors(ws.path))
  })

  r.get('/mirrors/:week', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readMirror(ws.path, req.params.week))
  })

  r.patch('/mirrors/:week/questions/:index', async (req, res) => {
    const ws = await wsOf(req)
    const { answer } = MirrorAnswerBody.parse(req.body)
    res.json(await answerQuestion(ws.path, req.params.week, Number(req.params.index), answer))
  })

  r.post('/mirrors/:week/change', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await applyChange(ws.path, req.params.week))
  })

  r.post('/mirror-job', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await enableMirrorJob(ws.path, ws.name))
  })

  // "Start with the AI": a chat session that interviews the user and creates the first identity.
  r.post('/interview', async (req, res) => {
    const ws = await wsOf(req)
    if (!opencode) throw httpError(503, 'The AI server is not configured')
    const sessionId = await opencode.createSession(ws.path, 'Becoming')
    await opencode.promptAsync(sessionId, INTERVIEW_PROMPT)
    res.status(201).json({ sessionId })
  })

  return r
}
