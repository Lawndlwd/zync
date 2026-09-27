import {
  createBoard,
  createCard,
  deleteBoard,
  deleteCard,
  listBoards,
  readBoard,
  runCardNow,
  updateBoard,
  updateCard,
} from '@zync/jobs'
import express, { Router } from 'express'

import { BoardBody, BoardPatchBody } from './body.js'
import { wsOf } from './workspace-param.js'

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
    res.status(201).json(await createBoard(ws.path, BoardBody.parse(req.body)))
  })

  r.get('/:board', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readBoard(ws.path, req.params.board))
  })

  r.patch('/:board', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await updateBoard(ws.path, req.params.board, BoardPatchBody.parse(req.body)))
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
