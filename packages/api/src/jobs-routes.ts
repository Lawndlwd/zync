import { deleteJob, listJobs, nextRuns, readJob, readRuns, requestRun, validateJob, writeJob } from '@zync/jobs'
import express, { Router } from 'express'
import { wsOf } from './workspace-param.js'

export function jobsRoutes(): Router {
  const r = Router({ mergeParams: true })

  r.get('/', async (req, res) => {
    const ws = await wsOf(req)
    const out = []
    for (const e of await listJobs(ws.path)) {
      const [lastRun] = await readRuns(ws.path, e.name, 1)
      out.push({
        name: e.name,
        error: e.error,
        job: e.job,
        nextRuns: e.job ? nextRuns(e.job).map((d) => d.toISOString()) : [],
        lastRun: lastRun ?? null,
      })
    }
    res.json(out)
  })

  r.get('/:name/runs', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readRuns(ws.path, req.params.name, Number(req.query.limit) || 50))
  })

  r.post('/:name/run', async (req, res) => {
    const ws = await wsOf(req)
    await requestRun(ws.path, req.params.name)
    res.status(202).json({ queued: req.params.name })
  })

  r.patch('/:name', express.json(), async (req, res) => {
    const ws = await wsOf(req)
    const job = await readJob(ws.path, req.params.name)
    if (typeof req.body?.enabled === 'boolean') job.enabled = req.body.enabled
    // Moving a one-shot job on the calendar. Recurring jobs keep their cron.
    if (typeof req.body?.at === 'string') {
      if (job.schedule)
        throw Object.assign(new Error('Recurring jobs are moved by editing their schedule'), { status: 400 })
      job.at = req.body.at
    }
    const next = validateJob(job)
    await writeJob(ws.path, next, { overwrite: true })
    res.json(next)
  })

  r.delete('/:name', async (req, res) => {
    const ws = await wsOf(req)
    await deleteJob(ws.path, req.params.name)
    res.status(204).end()
  })

  return r
}
