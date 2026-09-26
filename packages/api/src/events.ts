import path from 'node:path'
import { type FSWatcher, watch } from 'chokidar'
import type { Request, Response } from 'express'
import { wsOf } from './workspace-param.js'

type Listener = (event: { type: string; path: string }) => void

interface Shared {
  watcher: FSWatcher
  listeners: Set<Listener>
}

// One watcher per workspace, shared by all connected browsers, closed when the last one leaves.
const watchers = new Map<string, Shared>()
const IGNORED = /(^|[/\\])(\.git|node_modules|\.turbo|dist)([/\\]|$)/

function subscribe(wsPath: string, listener: Listener): () => void {
  let shared = watchers.get(wsPath)
  if (!shared) {
    const watcher = watch(wsPath, { ignoreInitial: true, ignored: (p) => IGNORED.test(p), depth: 12 })
    const listeners = new Set<Listener>()
    watcher.on('all', (type, file) => {
      const rel = path.relative(wsPath, file).split(path.sep).join('/')
      for (const l of listeners) l({ type, path: rel })
    })
    watcher.on('error', () => {})
    shared = { watcher, listeners }
    watchers.set(wsPath, shared)
  }
  shared.listeners.add(listener)
  return () => {
    shared.listeners.delete(listener)
    if (shared.listeners.size === 0) {
      void shared.watcher.close()
      watchers.delete(wsPath)
    }
  }
}

export async function eventsHandler(req: Request, res: Response): Promise<void> {
  const ws = await wsOf(req)
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.write(': connected\n\n')
  const unsubscribe = subscribe(ws.path, (e) => res.write(`data: ${JSON.stringify(e)}\n\n`))
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000)
  req.on('close', () => {
    clearInterval(ping)
    unsubscribe()
  })
}
