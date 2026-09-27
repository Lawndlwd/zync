import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { OpencodeClient } from '@zync/jobs'
import express, { type Request, Router } from 'express'
import {
  createLibraryItem,
  deleteLibraryEntry,
  type LibraryKind,
  listLibrary,
  readLibraryFile,
  resetSkill,
  writeLibraryFile,
} from './opencode-library.js'

// The opencode config file the chat and jobs run with, editable from Settings, plus a reload.
// The file is only ever written when it parses as JSON (opencode/configure.mjs needs plain JSON).

export interface RestartTiming {
  pollMs: number
  /** How long to wait for opencode to go down after asking. */
  downMs: number
  /** How long to wait for it to answer again. */
  upMs: number
}

export function opencodeRoutes(
  configPath: string,
  client = new OpencodeClient(),
  timing: RestartTiming = { pollMs: 250, downMs: 6000, upMs: 60_000 },
  /** zync's own skills (copied into the config folder at start-up), to compare and reset. */
  builtinSkillsDir?: string,
): Router {
  const r = Router()
  const configDir = path.dirname(configPath)
  const rel = (req: Request) => {
    const p = (req.params as Record<string, string | string[]>).path
    return Array.isArray(p) ? p.join('/') : p || ''
  }

  // ── agents, commands and skills (markdown files next to opencode.json) ──

  r.get('/library', async (_req, res) => {
    res.json({ dir: configDir, items: await listLibrary(configDir, builtinSkillsDir) })
  })

  r.post('/library', express.json(), async (req, res) => {
    const kind = req.body?.kind as LibraryKind
    if (!['agent', 'command', 'skill'].includes(kind)) {
      res.status(400).json({ error: 'kind must be agent, command or skill' })
      return
    }
    const file = await createLibraryItem(configDir, kind, String(req.body?.name || ''), req.body?.description)
    res.status(201).json({ path: file })
  })

  r.get('/files/*path', async (req, res) => {
    res.json(await readLibraryFile(configDir, rel(req)))
  })

  r.put('/files/*path', express.text({ type: () => true, limit: '2mb' }), async (req, res) => {
    const base = req.get('x-base-mtime')
    try {
      res.json(
        await writeLibraryFile(
          configDir,
          rel(req),
          typeof req.body === 'string' ? req.body : '',
          base === undefined ? undefined : Number(base),
        ),
      )
    } catch (err) {
      const e = err as { status?: number; mtime?: number; message: string }
      if (e.status !== 409) throw err
      res.status(409).json({ error: e.message, mtime: e.mtime })
    }
  })

  r.delete('/files/*path', async (req, res) => {
    await deleteLibraryEntry(configDir, rel(req))
    res.status(204).end()
  })

  r.post('/skills/:name/reset', async (req, res) => {
    await resetSkill(configDir, builtinSkillsDir, req.params.name)
    res.status(204).end()
  })

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
      res.status(400).json({ error: `Not valid JSON: ${(err as Error).message}` })
      return
    }
    // Refuse to overwrite a version the editor never saw (another tab, the start-up merge).
    const base = Number(req.get('x-base-mtime') ?? Number.NaN)
    const current = await stat(configPath).catch(() => null)
    if (current && !Number.isNaN(base) && Math.abs(current.mtimeMs - base) > 1) {
      res.status(409).json({ error: 'The config changed on disk since you opened it', mtime: current.mtimeMs })
      return
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
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const until = async (ok: (up: boolean) => boolean, ms: number) => {
      for (const end = Date.now() + ms; Date.now() < end; await sleep(timing.pollMs)) {
        if (ok(!!(await client.healthInfo())?.healthy)) return true
      }
      return false
    }
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(path.join(path.dirname(configPath), '.restart'), `${Date.now()}\n`)
    if (!(await until((up) => !up, timing.downMs))) {
      res.status(409).json({
        error:
          'The AI server did not restart: it is not running under zync’s supervisor. Restart it once by hand (pnpm dev:opencode, or redeploy).',
      })
      return
    }
    if (!(await until((up) => up, timing.upMs))) {
      res.status(504).json({ error: 'The AI server stopped but did not come back within a minute — check its logs' })
      return
    }
    res.json({ url: client.baseUrl, ...((await client.healthInfo()) ?? { healthy: true }) })
  })

  return r
}
