import { copyFile, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { badRequest, conflict, safeResolve, syncCardFile } from '@zync/jobs'
import express, { Router } from 'express'
import multer from 'multer'

import { FolderBody, MoveBody, OrderBody } from './body.js'
import { watchVersion } from './events.js'
import { isBinaryFile } from './helpers/binary.js'
import { relPath } from './helpers/request.js'
import { listFilesCached, searchWorkspace } from './search.js'
import { applyOrder, readOrder, renameInOrder, setOrder } from './tree-order.js'
import { wsOf } from './workspace-param.js'

const HIDDEN = new Set(['.git', 'node_modules', '.DS_Store'])
const MAX_TEXT_BYTES = 5 * 1024 * 1024
/** Files a browser would run scripts in when opened directly. */
const ACTIVE_CONTENT = /\.(html?|xhtml|svg|xml|xsl)$/i

type TreeEntry = {
  name: string
  path: string
  type: 'dir' | 'file'
  size: number
  mtime: number
}

export function fsRoutes(): Router {
  const r = Router({ mergeParams: true })
  // preservePath: a folder upload names each file by its path inside the folder.
  const upload = multer({
    dest: path.join(tmpdir(), 'zync-uploads'),
    preservePath: true,
    limits: { fileSize: 200 * 1024 * 1024 },
  })

  // One directory level; the UI expands folders lazily.
  r.get('/tree', async (req, res) => {
    const ws = await wsOf(req)
    const rel = typeof req.query.path === 'string' ? req.query.path : ''
    const showHidden = req.query.hidden === '1'
    const dir = await safeResolve(ws.path, rel)
    const dirents = await readdir(dir, { withFileTypes: true })
    const shown = dirents.filter((d) => !HIDDEN.has(d.name) && (showHidden || !d.name.startsWith('.')))
    const entries: TreeEntry[] = []
    for (const [i, s] of (
      await Promise.all(shown.map((d) => stat(path.join(dir, d.name)).catch(() => null)))
    ).entries()) {
      const d = shown[i]
      if (!s || !d) continue
      entries.push({
        name: d.name,
        path: path.relative(ws.path, path.join(dir, d.name)).split(path.sep).join('/'),
        type: s.isDirectory() ? 'dir' : 'file',
        size: s.size,
        mtime: s.mtimeMs,
      })
    }
    entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    const key = path.relative(ws.path, dir).split(path.sep).join('/')
    res.json({ path: rel, entries: applyOrder(entries, (await readOrder(ws.path))[key]) })
  })

  // The sidebar order of one folder (drag and drop), see tree-order.ts.
  r.put('/order', express.json(), async (req, res) => {
    const ws = await wsOf(req)
    const body = OrderBody.parse(req.body)
    const dir = await safeResolve(ws.path, body.dir)
    const { names } = body
    await setOrder(ws.path, path.relative(ws.path, dir).split(path.sep).join('/'), names)
    res.status(204).end()
  })

  // Every visible file in the workspace, newest first. `total` feeds the sidebar count.
  r.get('/recent', async (req, res) => {
    const ws = await wsOf(req)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100)
    // Tagging the (possibly cached) entries with the same `type` every time is harmless.
    const files = (await listFilesCached(ws.path, watchVersion(ws.path))).toSorted((a, b) => b.mtime - a.mtime)
    res.json({ total: files.length, entries: files.slice(0, limit).map((f) => Object.assign(f, { type: 'file' })) })
  })

  // Every file, newest first — for the editor's @-mention / [[link picker.
  r.get('/files', async (req, res) => {
    const ws = await wsOf(req)
    const files = (await listFilesCached(ws.path, watchVersion(ws.path))).toSorted((a, b) => b.mtime - a.mtime)
    res.json({ entries: files.map((f) => Object.assign(f, { type: 'file' })) })
  })

  // Full-text search (⌘K): accent/case-insensitive, phrase first, with matching lines.
  r.get('/search', async (req, res) => {
    const ws = await wsOf(req)
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50)
    res.json({ results: await searchWorkspace(ws.path, typeof req.query.q === 'string' ? req.query.q : '', limit) })
  })

  r.get('/file/*path', async (req, res) => {
    const ws = await wsOf(req)
    const file = await safeResolve(ws.path, relPath(req))
    const s = await stat(file)
    if (s.isDirectory()) {
      throw badRequest('Is a directory')
    }
    if (req.query.raw === '1') {
      // Workspace files are served from the app's own origin: a page or SVG written by anyone (or the
      // AI) must not run scripts with the app's cookies. Sandbox them; images, PDFs, media are left as-is.
      res.setHeader('X-Content-Type-Options', 'nosniff')
      if (ACTIVE_CONTENT.test(file)) res.setHeader('Content-Security-Policy', 'sandbox')
      res.sendFile(file, { dotfiles: 'allow' })
      return
    }
    const binary = s.size > MAX_TEXT_BYTES || (await isBinaryFile(file, 8192))
    const content = binary ? null : await readFile(file, 'utf8')
    res.json({ path: relPath(req), size: s.size, mtime: s.mtimeMs, binary, content })
  })

  r.put('/file/*path', express.text({ type: () => true, limit: '20mb' }), async (req, res) => {
    const ws = await wsOf(req)
    const file = await safeResolve(ws.path, relPath(req))
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, typeof req.body === 'string' ? req.body : '')
    // A card's frontmatter (assignee, runAt…) drives its AI job; keep them in step.
    await syncCardFile(ws.path, relPath(req)).catch(() => {})
    const s = await stat(file)
    res.json({ path: relPath(req), mtime: s.mtimeMs, size: s.size })
  })

  r.delete('/file/*path', async (req, res) => {
    const ws = await wsOf(req)
    const rel = relPath(req)
    const target = await safeResolve(ws.path, rel)
    if (target === ws.path) {
      throw badRequest('Refusing to delete the workspace root')
    }
    await stat(target)
    await rm(target, { recursive: true })
    res.status(204).end()
  })

  r.post('/folder', express.json(), async (req, res) => {
    const ws = await wsOf(req)
    const body = FolderBody.parse(req.body)
    const dir = await safeResolve(ws.path, body.path)
    await mkdir(dir, { recursive: true })
    res.status(201).json({ path: body.path })
  })

  r.post('/move', express.json(), async (req, res) => {
    const ws = await wsOf(req)
    const body = MoveBody.parse(req.body)
    const from = await safeResolve(ws.path, body.from)
    const to = await safeResolve(ws.path, body.to)
    if (from === ws.path) {
      throw badRequest('Cannot move the workspace root')
    }
    if (to === from || to.startsWith(from + path.sep)) {
      throw badRequest('Cannot move a folder into itself')
    }
    if (await stat(to).catch(() => null)) {
      throw conflict(`Already exists: ${body.to}`)
    }
    await mkdir(path.dirname(to), { recursive: true })
    await rename(from, to)
    const rel = (p: string) => path.relative(ws.path, p).split(path.sep).join('/')
    await renameInOrder(ws.path, rel(from), rel(to))
    res.json({ from: body.from, to: body.to })
  })

  r.post('/upload', upload.array('files'), async (req, res) => {
    const ws = await wsOf(req)
    const files = Array.isArray(req.files) ? req.files : []
    try {
      const dir = await safeResolve(ws.path, typeof req.query.dir === 'string' ? req.query.dir : '')
      await mkdir(dir, { recursive: true })
      const saved: string[] = []
      for (const f of files) {
        // multer decodes multipart filenames as latin1
        const name = Buffer.from(f.originalname, 'latin1')
          .toString('utf8')
          .split(/[/\\]+/)
          .filter((s) => s && s !== '.' && s !== '..')
          .join('/')
        if (!name) continue
        const target = await safeResolve(ws.path, path.join(path.relative(ws.path, dir), name))
        await mkdir(path.dirname(target), { recursive: true })
        // copy instead of rename: the temp dir is usually on another filesystem than the workspace mount
        await copyFile(f.path, target)
        saved.push(path.relative(ws.path, target).split(path.sep).join('/'))
      }
      res.status(201).json({ saved })
    } finally {
      await Promise.all(files.map((f) => unlink(f.path).catch(() => {})))
    }
  })

  return r
}
