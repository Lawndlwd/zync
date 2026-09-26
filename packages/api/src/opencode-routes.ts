import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { OpencodeClient } from '@zync/jobs'
import express, { Router } from 'express'

// The opencode config file the chat and jobs run with, editable from Settings, plus a reload.
// The file is only ever written when it parses as JSON (opencode/configure.mjs needs plain JSON).

export function opencodeRoutes(configPath: string, client = new OpencodeClient()): Router {
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

  // Reload opencode with the saved config: dispose every instance, then wait until it answers again.
  r.post('/restart', async (_req, res) => {
    try {
      await client.disposeAll()
    } catch (err) {
      res.status(502).json({ error: `Could not reach the AI server: ${(err as Error).message}` })
      return
    }
    for (let i = 0; i < 20; i++) {
      const h = await client.healthInfo()
      if (h?.healthy) {
        res.json({ url: client.baseUrl, ...h })
        return
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    res.status(504).json({ error: 'The AI server did not come back within 5 seconds' })
  })

  return r
}
