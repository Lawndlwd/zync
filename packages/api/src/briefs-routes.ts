import path from 'node:path'

import {
  conflict,
  createCard,
  enableBriefJob,
  linkTodo,
  listBriefs,
  notFound,
  readBrief,
  setTodoDone,
} from '@zync/jobs'
import express, { Router } from 'express'

import { BriefCardBody, BriefTodoPatchBody } from './body.js'
import { wsOf } from './workspace-param.js'

const day = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

/** Daily briefs (Briefs/<date>.md): list, read, turn a suggested to-do into a card, set up the job. */
export function briefsRoutes(): Router {
  const r = Router({ mergeParams: true })
  r.use(express.json())

  r.get('/', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await listBriefs(ws.path, day(req.query.from), day(req.query.to)))
  })

  r.post('/job', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await enableBriefJob(ws.path, ws.name))
  })

  r.get('/:date', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readBrief(ws.path, req.params.date))
  })

  r.patch('/:date/todos/:index', async (req, res) => {
    const ws = await wsOf(req)
    const { done } = BriefTodoPatchBody.parse(req.body)
    res.json(await setTodoDone(ws.path, req.params.date, Number(req.params.index), done))
  })

  r.post('/:date/todos/:index/card', async (req, res) => {
    const ws = await wsOf(req)
    const body = BriefCardBody.parse(req.body)
    const brief = await readBrief(ws.path, req.params.date)
    const index = Number(req.params.index)
    const todo = Number.isInteger(index) ? brief.todos[index] : undefined
    if (!todo) throw notFound('Unknown to-do')
    if (todo.card) throw conflict(`Already a card: ${todo.card}`)
    const description = [todo.source && `From ${todo.source}.`, todo.link && `[Open](${todo.link})`]
      .filter(Boolean)
      .join(' ')
    const card = await createCard(ws.path, body.board, {
      title: todo.title,
      due: brief.date,
      ...(body.status ? { status: body.status } : {}),
      ...(description ? { description } : {}),
    })
    const cardPath = path.posix.join(body.board, card.file)
    res.status(201).json({ brief: await linkTodo(ws.path, brief.date, index, cardPath), card: cardPath })
  })

  return r
}
