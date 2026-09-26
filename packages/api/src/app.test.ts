import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
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
    expect((await request(app).get('/api/workspaces')).body.map((w: any) => w.name)).toEqual(['alpha'])
    await request(app).post('/api/workspaces').send({ name: 'beta' }).expect(201)
    await request(app).post('/api/workspaces').send({ name: '../evil' }).expect(400)
    expect((await request(app).get('/api/workspaces')).body).toHaveLength(2)
  })

  it('404s on unknown workspace', async () => {
    await request(app).get('/api/ws/nope/tree').expect(404)
  })
})

describe('files', () => {
  it('lists one level, dirs first, hides dotfiles', async () => {
    await writeFile(path.join(root, 'alpha/z.txt'), 'z')
    const res = await request(app).get('/api/ws/alpha/tree').expect(200)
    expect(res.body.entries.map((e: any) => [e.name, e.type])).toEqual([
      ['notes', 'dir'],
      ['z.txt', 'file'],
    ])
    const hidden = await request(app).get('/api/ws/alpha/tree?hidden=1')
    expect(hidden.body.entries.map((e: any) => e.name)).toContain('.secret')
  })

  it('reads, writes (creating parents), deletes', async () => {
    const r = await request(app).get('/api/ws/alpha/file/notes/a.md').expect(200)
    expect(r.body).toMatchObject({ content: '# A', binary: false })
    await request(app)
      .put('/api/ws/alpha/file/new/deep/b.md')
      .set('content-type', 'text/markdown')
      .send('hello')
      .expect(200)
    expect(await readFile(path.join(root, 'alpha/new/deep/b.md'), 'utf8')).toBe('hello')
    await request(app).delete('/api/ws/alpha/file/new').expect(204)
    await request(app).get('/api/ws/alpha/file/new/deep/b.md').expect(404)
  })

  it('flags binary files and serves raw', async () => {
    await writeFile(path.join(root, 'alpha/img.bin'), Buffer.from([1, 0, 2]))
    const r = await request(app).get('/api/ws/alpha/file/img.bin').expect(200)
    expect(r.body).toMatchObject({ binary: true, content: null })
    await request(app).get('/api/ws/alpha/file/img.bin?raw=1').expect(200)
  })

  it('moves and refuses overwrite or move into itself', async () => {
    await request(app).post('/api/ws/alpha/move').send({ from: 'notes/a.md', to: 'archive/a.md' }).expect(200)
    expect(await readFile(path.join(root, 'alpha/archive/a.md'), 'utf8')).toBe('# A')
    await request(app).post('/api/ws/alpha/folder').send({ path: 'notes' }).expect(201)
    await writeFile(path.join(root, 'alpha/notes/a.md'), 'again')
    await request(app).post('/api/ws/alpha/move').send({ from: 'notes/a.md', to: 'archive/a.md' }).expect(409)
    await request(app).post('/api/ws/alpha/move').send({ from: 'archive', to: 'archive/sub' }).expect(400)
  })

  it('uploads files', async () => {
    const r = await request(app)
      .post('/api/ws/alpha/upload?dir=uploads')
      .attach('files', Buffer.from('data'), 'file one.txt')
      .expect(201)
    expect(r.body.saved).toEqual(['uploads/file one.txt'])
  })

  it('blocks traversal, symlink escape and root deletion', async () => {
    const outside = await mkdtemp(path.join(tmpdir(), 'out-'))
    await writeFile(path.join(outside, 's.txt'), 'secret')
    await symlink(outside, path.join(root, 'alpha/link'))
    await request(app).get('/api/ws/alpha/file/..%2F..%2Fetc%2Fpasswd').expect(400)
    await request(app).get('/api/ws/alpha/file/link/s.txt').expect(400)
    await request(app).put('/api/ws/alpha/file/link/new.txt').send('x').expect(400)
    await request(app).post('/api/ws/alpha/move').send({ from: 'notes/a.md', to: '../beta/a.md' }).expect(400)
    await request(app).get('/api/ws/alpha/tree?path=../').expect(400)
    await request(app).delete('/api/ws/alpha/file/').expect(404)
  })
})

describe('jobs', () => {
  it('lists jobs with next runs, toggles, queues runs, deletes', async () => {
    await mkdir(path.join(root, 'alpha/.opencode/jobs'), { recursive: true })
    await writeFile(
      path.join(root, 'alpha/.opencode/jobs/daily.md'),
      '---\nname: daily\nschedule: "0 9 * * *"\n---\nDo it\n',
    )
    const list = await request(app).get('/api/ws/alpha/jobs').expect(200)
    expect(list.body[0]).toMatchObject({ name: 'daily', lastRun: null })
    expect(list.body[0].nextRuns).toHaveLength(3)

    await request(app).patch('/api/ws/alpha/jobs/daily').send({ enabled: false }).expect(200)
    expect((await request(app).get('/api/ws/alpha/jobs')).body[0].nextRuns).toEqual([])

    await request(app).post('/api/ws/alpha/jobs/daily/run').expect(202)
    await request(app).post('/api/ws/alpha/jobs/missing/run').expect(404)
    await request(app).delete('/api/ws/alpha/jobs/daily').expect(204)
    expect((await request(app).get('/api/ws/alpha/jobs')).body).toEqual([])
  })
})
