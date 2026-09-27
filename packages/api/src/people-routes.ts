import { createPerson, deletePerson, listPeople, updatePerson } from '@zync/jobs'
import express, { Router } from 'express'

import { PersonBody, PersonPatchBody } from './body.js'

/** Global people list, stored in the workspaces root. */
export function peopleRoutes(root: string): Router {
  const r = Router()
  r.use(express.json())

  r.get('/', async (_req, res) => {
    res.json(await listPeople(root))
  })

  r.post('/', async (req, res) => {
    res.status(201).json(await createPerson(PersonBody.parse(req.body), root))
  })

  r.patch('/:id', async (req, res) => {
    res.json(await updatePerson(req.params.id, PersonPatchBody.parse(req.body), root))
  })

  r.delete('/:id', async (req, res) => {
    await deletePerson(req.params.id, root)
    res.status(204).end()
  })

  return r
}
