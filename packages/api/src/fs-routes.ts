import { copyFile, mkdir, open, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { safeResolve, syncCardFile } from '@zync/jobs'
import express, { type Request, Router } from 'express'
import multer from 'multer'
import { wsOf } from './workspace-param.js'

const HIDDEN = new Set(['.git', 'node_modules', '.DS_Store'])
const MAX_TEXT_BYTES = 5 * 1024 * 1024

export interface TreeEntry {
  name: string
  path: string
  type: 'dir' | 'file'
  size: number
  mtime: number
}

function relPath(req: Request): string {
  const p = (req.params as Record<string, string | string[]>).path
  return Array.isArray(p) ? p.join('/') : p || ''
}

async function isBinary(file: string, size: number): Promise<boolean> {
  if (size === 0) return false
  const fh = await open(file, 'r')
  try {
    const buf = Buffer.alloc(Math.min(8192, size))
    await fh.read(buf, 0, buf.length, 0)
    return buf.includes(0)
  } finally {
    await fh.close()
  }
}

export function fsRoutes(): Router {
  const r = Router({ mergeParams: true })
  const upload = multer({ dest: path.join(tmpdir(), 'zync-uploads'), limits: { fileSize: 200 * 1024 * 1024 } })

  // One directory level; the UI expands folders lazily.
  r.get('/tree', async (req, res) => {
    const ws = await wsOf(req)
    const rel = String(req.query.path || '')
    const showHidden = req.query.hidden === '1'
    const dir = await safeResolve(ws.path, rel)
    const dirents = await readdir(dir, { withFileTypes: true })
    const entries: TreeEntry[] = []
    for (const d of dirents) {
      if (HIDDEN.has(d.name) || (!showHidden && d.name.startsWith('.'))) continue
      const full = path.join(dir, d.name)
      const s = await stat(full).catch(() => null)
      if (!s) continue
      entries.push({
        name: d.name,
        path: path.relative(ws.path, full).split(path.sep).join('/'),
        type: s.isDirectory() ? 'dir' : 'file',
        size: s.size,
        mtime: s.mtimeMs,
      })
    }
    entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    res.json({ path: rel, entries })
  })

  // Every visible file in the workspace, newest first. `total` feeds the sidebar count.
  r.get('/recent', async (req, res) => {
    const ws = await wsOf(req)
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100)
    const files: TreeEntry[] = []
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 8) return
      const dirents = await readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const d of dirents) {
        if (HIDDEN.has(d.name) || d.name.startsWith('.')) continue
        const full = path.join(dir, d.name)
        if (d.isDirectory()) {
          await walk(full, depth + 1)
          continue
        }
        if (!d.isFile()) continue
        const s = await stat(full).catch(() => null)
        if (!s) continue
        files.push({
          name: d.name,
          path: path.relative(ws.path, full).split(path.sep).join('/'),
          type: 'file',
          size: s.size,
          mtime: s.mtimeMs,
        })
      }
    }
    await walk(ws.path, 0)
    files.sort((a, b) => b.mtime - a.mtime)
    res.json({ total: files.length, entries: files.slice(0, limit) })
  })

  r.get('/file/*path', async (req, res) => {
    const ws = await wsOf(req)
    const file = await safeResolve(ws.path, relPath(req))
    const s = await stat(file)
    if (s.isDirectory()) {
      res.status(400).json({ error: 'Is a directory' })
      return
    }
    if (req.query.raw === '1') {
      res.sendFile(file, { dotfiles: 'allow' })
      return
    }
    const binary = s.size > MAX_TEXT_BYTES || (await isBinary(file, s.size))
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
      res.status(400).json({ error: 'Refusing to delete the workspace root' })
      return
    }
    await stat(target)
    await rm(target, { recursive: true })
    res.status(204).end()
  })

  r.post('/folder', express.json(), async (req, res) => {
    const ws = await wsOf(req)
    const dir = await safeResolve(ws.path, String(req.body?.path || ''))
    await mkdir(dir, { recursive: true })
    res.status(201).json({ path: req.body.path })
  })

  r.post('/move', express.json(), async (req, res) => {
    const ws = await wsOf(req)
    const from = await safeResolve(ws.path, String(req.body?.from || ''))
    const to = await safeResolve(ws.path, String(req.body?.to || ''))
    if (from === ws.path) {
      res.status(400).json({ error: 'Cannot move the workspace root' })
      return
    }
    if (to === from || to.startsWith(from + path.sep)) {
      res.status(400).json({ error: 'Cannot move a folder into itself' })
      return
    }
    if (await stat(to).catch(() => null)) {
      res.status(409).json({ error: `Already exists: ${req.body.to}` })
      return
    }
    await mkdir(path.dirname(to), { recursive: true })
    await rename(from, to)
    res.json({ from: req.body.from, to: req.body.to })
  })

  r.post('/upload', upload.array('files'), async (req, res) => {
    const ws = await wsOf(req)
    const files = (req.files as Express.Multer.File[]) || []
    try {
      const dir = await safeResolve(ws.path, String(req.query.dir || ''))
      await mkdir(dir, { recursive: true })
      const saved: string[] = []
      for (const f of files) {
        // multer decodes multipart filenames as latin1
        const name = path.basename(Buffer.from(f.originalname, 'latin1').toString('utf8'))
        const target = await safeResolve(ws.path, path.join(path.relative(ws.path, dir), name))
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
