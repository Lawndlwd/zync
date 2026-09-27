import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { badRequest, conflict, errorMessage, httpError, type OpencodeClient, sleep } from '@zync/jobs'
import express, { Router } from 'express'

// The opencode config file the chat and jobs run with, editable from Settings, plus a reload.
// The file is only ever written when it parses as JSON (opencode/configure.mjs needs plain JSON).

export type RestartTiming = {
  pollMs: number
  /** How long to wait for opencode to go down after asking. */
  downMs: number
  /** How long to wait for it to answer again. */
  upMs: number
}

export function opencodeConfigRoutes(configPath: string, client: OpencodeClient, timing: RestartTiming): Router {
  const r = Router()

  r.get('/config', async (_req, res) => {
    const s = await stat(configPath).catch(() => null)
    const content = s ? await readFile(configPath, 'utf8') : '{\n  "$schema": "https://opencode.ai/config.json"\n}\n'
    res.json({ path: configPath, exists: !!s, mtime: s?.mtimeMs ?? 0, content })
  })

  r.put('/config', express.text({ type: () => true, limit: '2mb' }), async (req, res) => {
    const content = typeof req.body === 'string' ? req.body : ''
    try {
      JSON.parse(content)
    } catch (err) {
      throw badRequest(`Not valid JSON: ${errorMessage(err)}`)
    }
    // Refuse to overwrite a version the editor never saw (another tab, the start-up merge).
    const base = Number(req.get('x-base-mtime') ?? Number.NaN)
    const current = await stat(configPath).catch(() => null)
    if (current && !Number.isNaN(base) && Math.abs(current.mtimeMs - base) > 1) {
      throw Object.assign(conflict('The config changed on disk since you opened it'), { mtime: current.mtimeMs })
    }
    await mkdir(path.dirname(configPath), { recursive: true })
    const tmp = `${configPath}.${process.pid}.tmp`
    await writeFile(tmp, content.endsWith('\n') ? content : `${content}\n`)
    await rename(tmp, configPath)
    const s = await stat(configPath)
    res.json({ mtime: s.mtimeMs })
  })

  r.get('/health', async (_req, res) => {
    res.json({ url: client.baseUrl, ...((await client.healthInfo()) ?? { healthy: false }) })
  })

  // A real restart (opencode loads providers/models once per process): ask opencode/run.sh, which
  // watches <config dir>/.restart, then wait for opencode to go down and come back up.
  r.post('/restart', async (_req, res) => {
    const until = async (ok: (up: boolean) => boolean, ms: number) => {
      for (const end = Date.now() + ms; Date.now() < end; await sleep(timing.pollMs)) {
        if (ok(!!(await client.healthInfo())?.healthy)) return true
      }
      return false
    }
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(path.join(path.dirname(configPath), '.restart'), `${Date.now()}\n`)
    if (!(await until((up) => !up, timing.downMs))) {
      throw conflict(
        'The AI server did not restart: it is not running under zync’s supervisor. Restart it once by hand (pnpm dev:opencode, or redeploy).',
      )
    }
    if (!(await until((up) => up, timing.upMs))) {
      throw httpError(504, 'The AI server stopped but did not come back within a minute — check its logs')
    }
    res.json({ url: client.baseUrl, ...((await client.healthInfo()) ?? { healthy: true }) })
  })

  return r
}
