import {
  createBoard,
  createCard,
  createPerson,
  deleteBoard,
  deleteCard,
  deletePerson,
  listBoards,
  listPeople,
  readBoard,
  runCardNow,
  updateBoard,
  updateCard,
  updatePerson,
} from '@zync/jobs'
import express, { Router } from 'express'
import { wsOf } from './workspace-param.js'

/** Global people list, stored in the workspaces root. */
export function peopleRoutes(root: string): Router {
  const r = Router()
  r.use(express.json())

  r.get('/', async (_req, res) => {
    res.json(await listPeople(root))
  })

  r.post('/', async (req, res) => {
    res.status(201).json(await createPerson({ name: String(req.body?.name || ''), color: req.body?.color }, root))
  })

  r.patch('/:id', async (req, res) => {
    res.json(await updatePerson(req.params.id, { name: req.body?.name, color: req.body?.color }, root))
  })

  r.delete('/:id', async (req, res) => {
    await deletePerson(req.params.id, root)
    res.status(204).end()
  })

  return r
}

/**
 * `:board` is the board's workspace-relative folder path, URL-encoded as one segment
 * (e.g. "projects%2FSprint%201"); `:file` is the card's file name.
 */
export function boardsRoutes(): Router {
  const r = Router({ mergeParams: true })
  r.use(express.json())

  r.get('/', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await listBoards(ws.path))
  })

  r.post('/', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(
      await createBoard(ws.path, {
        name: String(req.body?.name || ''),
        parent: req.body?.parent,
        columns: Array.isArray(req.body?.columns) ? req.body.columns : undefined,
      }),
    )
  })

  r.get('/:board', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readBoard(ws.path, req.params.board))
  })

  r.patch('/:board', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await updateBoard(ws.path, req.params.board, { name: req.body?.name, columns: req.body?.columns }))
  })

  r.delete('/:board', async (req, res) => {
    const ws = await wsOf(req)
    await deleteBoard(ws.path, req.params.board)
    res.status(204).end()
  })

  r.post('/:board/cards', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await createCard(ws.path, req.params.board, req.body ?? {}))
  })

  r.patch('/:board/cards/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await updateCard(ws.path, req.params.board, req.params.file, req.body ?? {}))
  })

  r.delete('/:board/cards/:file', async (req, res) => {
    const ws = await wsOf(req)
    await deleteCard(ws.path, req.params.board, req.params.file)
    res.status(204).end()
  })

  r.post('/:board/cards/:file/run', async (req, res) => {
    const ws = await wsOf(req)
    res.status(202).json(await runCardNow(ws.path, req.params.board, req.params.file))
  })

  return r
}
