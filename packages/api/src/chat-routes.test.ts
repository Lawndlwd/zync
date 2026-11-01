import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { OpencodeClient } from '@zync/jobs'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApp } from './app.js'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'api-chat-'))
  await mkdir(path.join(root, 'alpha'))
})

describe('chat session', () => {
  it('creates a session in the workspace folder', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ data: { id: 'ses_new' } }))
    vi.stubGlobal('fetch', fetchMock)
    const app = createApp({ workspacesRoot: root, opencodeClient: new OpencodeClient({ baseUrl: 'http://oc.test' }) })
    const res = await request(app).post('/zync/api/ws/alpha/chat/session').expect(201)
    expect(res.body).toEqual({ id: 'ses_new' })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('http://oc.test/api/session')
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '')).toEqual({
      location: { directory: path.join(root, 'alpha') },
    })
    vi.unstubAllGlobals()
  })

  it('503s without an AI server and 404s an unknown workspace', async () => {
    const app = createApp({ workspacesRoot: root })
    expect((await request(app).post('/zync/api/ws/alpha/chat/session')).status).toBe(503)
    expect((await request(app).post('/zync/api/ws/nope/chat/session')).status).toBe(404)
  })
})
