import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from './app.js'
import { OPENCODE_SW_REPLACEMENT } from './opencode-sw.js'

type Tab = { frameType: string; url: string }
type Listener = (event: { waitUntil: (work: Promise<unknown>) => void }) => void

/** Runs the worker against a fake browser and returns what its activation did. */
async function activate(cacheNames: string[], tabs: Tab[]) {
  const listeners = new Map<string, Listener>()
  const deleted: string[] = []
  const reloaded: string[] = []
  const self = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: () => undefined,
    clients: {
      matchAll: async () =>
        tabs.map((tab) => ({
          ...tab,
          navigate: async (url: string) => {
            reloaded.push(url)
          },
        })),
    },
  }
  const caches = {
    keys: async () => cacheNames,
    delete: async (name: string) => {
      deleted.push(name)
      return true
    },
  }
  runInNewContext(OPENCODE_SW_REPLACEMENT, { self, caches })

  let work: Promise<unknown> = Promise.resolve()
  listeners.get('activate')?.({
    waitUntil: (p) => {
      work = p
    },
  })
  await work
  return { deleted, reloaded, listens: [...listeners.keys()] }
}

describe('opencode service worker replacement', () => {
  it('never handles requests, so navigations reach the server', async () => {
    const { listens } = await activate([], [])
    expect(listens).not.toContain('fetch')
  })

  it("clears opencode's precache and reloads open tabs, not their frames", async () => {
    const result = await activate(
      ['workbox-precache-v2-https://zync.example/', 'other'],
      [
        { frameType: 'top-level', url: 'https://zync.example/w/notes' },
        { frameType: 'nested', url: 'https://zync.example/server/x/session/ses_1' },
      ],
    )
    expect(result.deleted).toEqual(['workbox-precache-v2-https://zync.example/'])
    expect(result.reloaded).toEqual(['https://zync.example/w/notes'])
  })

  it('does not reload when opencode registers it again', async () => {
    const result = await activate([], [{ frameType: 'top-level', url: 'https://zync.example/w/notes' }])
    expect(result.reloaded).toEqual([])
  })

  it("is served by zync instead of opencode's worker", async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'zync-sw-'))
    const seen: Array<string | undefined> = []
    const upstream = createServer((req, res) => {
      seen.push(req.url)
      res.end('opencode')
    })
    await new Promise<void>((resolve) => {
      upstream.listen(0, '127.0.0.1', resolve)
    })
    const address = upstream.address()
    if (address === null || typeof address === 'string') throw new Error('no port')
    try {
      const app = createApp({ workspacesRoot: root, opencodeUrl: `http://127.0.0.1:${address.port}` })
      const res = await request(app).get('/sw.js').expect(200)
      expect(res.headers['content-type']).toContain('text/javascript')
      expect(res.headers['cache-control']).toBe('no-cache')
      expect(res.text).toBe(OPENCODE_SW_REPLACEMENT)
      expect(seen).toEqual([])
    } finally {
      upstream.close()
      await rm(root, { recursive: true, force: true })
    }
  })
})
