import { mkdir, mkdtemp, readdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from './app.js'

let root: string
let app: ReturnType<typeof createApp>

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'api-'))
  await mkdir(path.join(root, 'alpha/notes'), { recursive: true })
  await writeFile(path.join(root, 'alpha/notes/a.md'), '# A')
  await writeFile(path.join(root, 'alpha/.secret'), 'x')
  app = createApp({ workspacesRoot: root, chatUrl: 'http://chat' })
})

describe('workspaces', () => {
  it('lists and creates', async () => {
    expect((await request(app).get('/zync/api/workspaces')).body.map((w: any) => w.name)).toEqual(['alpha'])
    await request(app).post('/zync/api/workspaces').send({ name: 'beta' }).expect(201)
    await request(app).post('/zync/api/workspaces').send({ name: '../evil' }).expect(400)
    expect((await request(app).get('/zync/api/workspaces')).body).toHaveLength(2)
  })

  it('404s on unknown workspace', async () => {
    await request(app).get('/zync/api/ws/nope/tree').expect(404)
  })
})

describe('files', () => {
  it('lists one level, dirs first, hides dotfiles', async () => {
    await writeFile(path.join(root, 'alpha/z.txt'), 'z')
    const res = await request(app).get('/zync/api/ws/alpha/tree').expect(200)
    expect(res.body.entries.map((e: any) => [e.name, e.type])).toEqual([
      ['notes', 'dir'],
      ['z.txt', 'file'],
    ])
    const hidden = await request(app).get('/zync/api/ws/alpha/tree?hidden=1')
    expect(hidden.body.entries.map((e: any) => e.name)).toContain('.secret')
  })

  it('lists recent files recursively, newest first, skipping dotfiles', async () => {
    await new Promise((r) => setTimeout(r, 15))
    await writeFile(path.join(root, 'alpha/z.txt'), 'z')
    const res = await request(app).get('/zync/api/ws/alpha/recent?limit=1').expect(200)
    expect(res.body.total).toBe(2)
    expect(res.body.entries.map((e: any) => e.path)).toEqual(['z.txt'])
  })

  it('reads, writes (creating parents), deletes', async () => {
    const r = await request(app).get('/zync/api/ws/alpha/file/notes/a.md').expect(200)
    expect(r.body).toMatchObject({ content: '# A', binary: false })
    await request(app)
      .put('/zync/api/ws/alpha/file/new/deep/b.md')
      .set('content-type', 'text/markdown')
      .send('hello')
      .expect(200)
    expect(await readFile(path.join(root, 'alpha/new/deep/b.md'), 'utf8')).toBe('hello')
    await request(app).delete('/zync/api/ws/alpha/file/new').expect(204)
    await request(app).get('/zync/api/ws/alpha/file/new/deep/b.md').expect(404)
  })

  it('flags binary files and serves raw', async () => {
    await writeFile(path.join(root, 'alpha/img.bin'), Buffer.from([1, 0, 2]))
    const r = await request(app).get('/zync/api/ws/alpha/file/img.bin').expect(200)
    expect(r.body).toMatchObject({ binary: true, content: null })
    await request(app).get('/zync/api/ws/alpha/file/img.bin?raw=1').expect(200)
  })

  it('moves and refuses overwrite or move into itself', async () => {
    await request(app).post('/zync/api/ws/alpha/move').send({ from: 'notes/a.md', to: 'archive/a.md' }).expect(200)
    expect(await readFile(path.join(root, 'alpha/archive/a.md'), 'utf8')).toBe('# A')
    await request(app).post('/zync/api/ws/alpha/folder').send({ path: 'notes' }).expect(201)
    await writeFile(path.join(root, 'alpha/notes/a.md'), 'again')
    await request(app).post('/zync/api/ws/alpha/move').send({ from: 'notes/a.md', to: 'archive/a.md' }).expect(409)
    await request(app).post('/zync/api/ws/alpha/move').send({ from: 'archive', to: 'archive/sub' }).expect(400)
  })

  it('uploads files', async () => {
    const r = await request(app)
      .post('/zync/api/ws/alpha/upload?dir=uploads')
      .attach('files', Buffer.from('data'), 'file one.txt')
      .expect(201)
    expect(r.body.saved).toEqual(['uploads/file one.txt'])
  })

  it('blocks traversal, symlink escape and root deletion', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'out-'))
    await writeFile(path.join(outside, 's.txt'), 'secret')
    await symlink(outside, path.join(root, 'alpha/link'))
    await request(app).get('/zync/api/ws/alpha/file/..%2F..%2Fetc%2Fpasswd').expect(400)
    await request(app).get('/zync/api/ws/alpha/file/link/s.txt').expect(400)
    await request(app).put('/zync/api/ws/alpha/file/link/new.txt').send('x').expect(400)
    await request(app).post('/zync/api/ws/alpha/move').send({ from: 'notes/a.md', to: '../beta/a.md' }).expect(400)
    await request(app).get('/zync/api/ws/alpha/tree?path=../').expect(400)
    await request(app).delete('/zync/api/ws/alpha/file/').expect(404)
  })
})

describe('jobs', () => {
  it('lists jobs with next runs, toggles, queues runs, deletes', async () => {
    await mkdir(path.join(root, 'alpha/.opencode/jobs'), { recursive: true })
    await writeFile(
      path.join(root, 'alpha/.opencode/jobs/daily.md'),
      '---\nname: daily\nschedule: "0 9 * * *"\n---\nDo it\n',
    )
    const list = await request(app).get('/zync/api/ws/alpha/jobs').expect(200)
    expect(list.body[0]).toMatchObject({ name: 'daily', lastRun: null })
    expect(list.body[0].nextRuns).toHaveLength(3)

    await request(app).patch('/zync/api/ws/alpha/jobs/daily').send({ enabled: false }).expect(200)
    expect((await request(app).get('/zync/api/ws/alpha/jobs')).body[0].nextRuns).toEqual([])

    await request(app).post('/zync/api/ws/alpha/jobs/daily/run').expect(202)
    await request(app).post('/zync/api/ws/alpha/jobs/missing/run').expect(404)
    await request(app).delete('/zync/api/ws/alpha/jobs/daily').expect(204)
    expect((await request(app).get('/zync/api/ws/alpha/jobs')).body).toEqual([])
  })
})

describe('boards', () => {
  it('creates a board folder, adds, moves and deletes card files', async () => {
    const board = (await request(app).post('/zync/api/ws/alpha/boards').send({ name: 'Sprint 1' }).expect(201)).body
    expect(board.path).toBe('Sprint 1')
    expect((await request(app).get('/zync/api/ws/alpha/boards')).body.map((b: any) => b.path)).toEqual(['Sprint 1'])

    const b = `/zync/api/ws/alpha/boards/${encodeURIComponent(board.path)}`
    const card = (await request(app).post(`${b}/cards`).send({ title: 'Task one', status: 'todo' }).expect(201)).body
    expect(card.file).toBe('Task one.md')
    await request(app)
      .patch(`${b}/cards/${encodeURIComponent(card.file)}`)
      .send({ status: 'doing', assignee: 'me' })
      .expect(200)
    const { cards } = (await request(app).get(b).expect(200)).body
    expect(cards[0]).toMatchObject({ status: 'doing', assignee: 'me' })
    // It's an ordinary file in the workspace.
    const tree = (await request(app).get('/zync/api/ws/alpha/tree?path=Sprint%201')).body
    expect(tree.entries.map((e: any) => e.name)).toEqual(['Task one.md'])

    await request(app).post(`${b}/cards`).send({}).expect(400)
    await request(app)
      .delete(`${b}/cards/${encodeURIComponent(card.file)}`)
      .expect(204)
    await request(app).get('/zync/api/ws/alpha/boards/nope').expect(404)
    await request(app).get('/zync/api/ws/alpha/boards/notes').expect(404)
  })

  it('saving a card file directly keeps its AI job in step', async () => {
    await request(app).post('/zync/api/ws/alpha/boards').send({ name: 'B' }).expect(201)
    const src = '---\nassignee: ai\nrunAt: 2099-01-01T09:00\n---\n\nDo the thing\n'
    await request(app)
      .put('/zync/api/ws/alpha/file/B/Task.md')
      .set('content-type', 'text/markdown')
      .send(src)
      .expect(200)
    const jobs = (await request(app).get('/zync/api/ws/alpha/jobs').expect(200)).body
    expect(jobs.map((j: any) => j.job?.card)).toEqual(['B/Task.md'])
    const { cards } = (await request(app).get('/zync/api/ws/alpha/boards/B').expect(200)).body
    expect(cards[0]).toMatchObject({ title: 'Task', description: 'Do the thing', ai: { state: 'scheduled' } })
  })

  it('handles boards in nested folders', async () => {
    const board = (
      await request(app).post('/zync/api/ws/alpha/boards').send({ name: 'Board', parent: 'notes' }).expect(201)
    ).body
    expect(board.path).toBe('notes/Board')
    await request(app)
      .get(`/zync/api/ws/alpha/boards/${encodeURIComponent('notes/Board')}`)
      .expect(200)
  })

  it('run now queues the linked job', async () => {
    const board = (await request(app).post('/zync/api/ws/alpha/boards').send({ name: 'B' })).body
    const card = (await request(app).post(`/zync/api/ws/alpha/boards/${board.path}/cards`).send({ title: 'Do it' }))
      .body
    const res = await request(app)
      .post(`/zync/api/ws/alpha/boards/${board.path}/cards/${encodeURIComponent(card.file)}/run`)
      .expect(202)
    expect(res.body).toMatchObject({ assignee: 'ai', ai: { state: 'scheduled' } })
    const triggers = await readdir(path.join(root, 'alpha/.opencode/jobs/.trigger'))
    expect(triggers).toHaveLength(1)
    expect(triggers[0]).toMatch(/^card-do-it-/)
  })
})

describe('people', () => {
  it('lists builtins, creates and deletes people', async () => {
    expect((await request(app).get('/zync/api/people')).body.map((p: any) => p.id)).toEqual(['me', 'ai'])
    const bob = (await request(app).post('/zync/api/people').send({ name: 'Bob' }).expect(201)).body
    await request(app).patch(`/zync/api/people/${bob.id}`).send({ color: '#22c55e' }).expect(200)
    await request(app).delete('/zync/api/people/ai').expect(400)
    await request(app).delete(`/zync/api/people/${bob.id}`).expect(204)
    // people.json lives in the root's .zync dir, which is not a workspace
    expect((await request(app).get('/zync/api/workspaces')).body.map((w: any) => w.name)).toEqual(['alpha'])
  })
})

describe('board columns', () => {
  it('renames a board without touching its columns', async () => {
    await request(app).post('/zync/api/ws/alpha/boards').send({ name: 'B' })
    const res = await request(app).patch('/zync/api/ws/alpha/boards/B').send({ name: 'Renamed' }).expect(200)
    expect(res.body).toMatchObject({ name: 'Renamed', path: 'Renamed' })
    expect(res.body.columns).toHaveLength(5)
  })
})

describe('opencode config', () => {
  const fake = {
    baseUrl: 'http://oc',
    healthInfo: async () => ({ healthy: true, version: '1' }),
  }
  const make = (file: string) =>
    createApp({ workspacesRoot: root, opencodeConfigPath: file, opencodeClient: fake as any })

  it('reads, validates, saves and detects conflicts', async () => {
    const file = path.join(root, 'oc', 'opencode.json')
    const a = make(file)
    const first = (await request(a).get('/zync/api/opencode/config').expect(200)).body
    expect(first).toMatchObject({ exists: false, path: file })

    await request(a).put('/zync/api/opencode/config').set('content-type', 'text/plain').send('{ nope').expect(400)
    const saved = (
      await request(a)
        .put('/zync/api/opencode/config')
        .set('content-type', 'text/plain')
        .send('{"model":"x"}')
        .expect(200)
    ).body
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ model: 'x' })

    await request(a)
      .put('/zync/api/opencode/config')
      .set('content-type', 'text/plain')
      .set('x-base-mtime', String(saved.mtime - 60_000))
      .send('{}')
      .expect(409)
    await request(a)
      .put('/zync/api/opencode/config')
      .set('content-type', 'text/plain')
      .set('x-base-mtime', String(saved.mtime))
      .send('{}')
      .expect(200)
  })

  const timing = { pollMs: 5, downMs: 100, upMs: 200 }

  it('restart asks the supervisor and waits for opencode to go down and come back', async () => {
    const dir = path.join(root, 'oc2')
    // opencode answers, then is down for two checks while the supervisor restarts it, then is back.
    const states = [false, false, true]
    const client = { baseUrl: 'http://oc', healthInfo: async () => ({ healthy: states.shift() ?? true, version: '2' }) }
    const a = createApp({
      workspacesRoot: root,
      opencodeConfigPath: path.join(dir, 'opencode.json'),
      opencodeClient: client as any,
      restartTiming: timing,
    })
    const res = (await request(a).post('/zync/api/opencode/restart').expect(200)).body
    expect(res).toMatchObject({ healthy: true, version: '2' })
    expect(await readFile(path.join(dir, '.restart'), 'utf8')).toMatch(/^\d+\n$/)
  })

  it('restart says so when opencode is not supervised (never goes down)', async () => {
    const a = createApp({
      workspacesRoot: root,
      opencodeConfigPath: path.join(root, 'oc3', 'opencode.json'),
      opencodeClient: fake as any,
      restartTiming: timing,
    })
    const res = await request(a).post('/zync/api/opencode/restart').expect(409)
    expect(res.body.error).toMatch(/supervisor/)
  })
})

describe('opencode proxy', () => {
  it('forwards everything outside the app paths to opencode, with bodies and without Origin', async () => {
    const { createServer } = await import('node:http')
    const seen: { method?: string; url?: string; origin?: string; body: string }[] = []
    const upstream = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        seen.push({ method: req.method, url: req.url, origin: req.headers.origin, body })
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ from: 'opencode', url: req.url }))
      })
    })
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r))
    const { port } = upstream.address() as { port: number }
    const a = createApp({ workspacesRoot: root, opencodeUrl: `http://127.0.0.1:${port}` })
    try {
      // opencode's own /api paths and assets go through…
      expect((await request(a).get('/api/health').expect(200)).body).toEqual({ from: 'opencode', url: '/api/health' })
      await request(a).get('/assets/index.js?v=1').expect(200)
      await request(a)
        .post('/session?directory=/x')
        .set('origin', 'https://zync.example')
        .send({ title: 't' })
        .expect(200)
      // …zync's API stays in the app.
      expect((await request(a).get('/zync/api/health').expect(200)).body).toEqual({ ok: true })
      await request(a).get('/zync/api/nope').expect(404)
      expect(seen.map((s) => s.url)).toEqual(['/api/health', '/assets/index.js?v=1', '/session?directory=/x'])
      expect(seen[2]).toMatchObject({ method: 'POST', origin: undefined, body: '{"title":"t"}' })
    } finally {
      upstream.close()
    }
  })
})
