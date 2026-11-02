import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'

import { createApp } from './app.js'

let app: ReturnType<typeof createApp>
const b = '/zync/api/ws/alpha/becoming'

beforeEach(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'api-becoming-'))
  await mkdir(path.join(root, 'alpha'))
  app = createApp({ workspacesRoot: root })
})

const writer = { statement: 'I am a writer', action: 'Write 300 words', small: 'One sentence', when: 'morning' }

describe('becoming', () => {
  it('creates, edits and lists identities', async () => {
    const made = await request(app).post(`${b}/identities`).send(writer).expect(201)
    expect(made.body.file).toBe('writer.md')
    await request(app).patch(`${b}/identities/writer.md`).send({ minutes: 40 }).expect(200)
    const list = await request(app).get(`${b}/identities`).expect(200)
    expect(list.body.map((i: { minutes: number }) => i.minutes)).toEqual([40])
  })

  it('rejects bad input and unknown identities', async () => {
    await request(app).post(`${b}/identities`).send({ statement: 'I am a writer' }).expect(400)
    await request(app).patch(`${b}/identities/writer.md`).send({ when: 'someday' }).expect(400)
    await request(app).get(`${b}/identities/nope.md`).expect(404)
    const escape = await request(app).get(`${b}/identities/..%2Fsecret.md`)
    expect(escape.status).toBe(404)
  })

  it('votes and shows the vote on today', async () => {
    await request(app).post(`${b}/identities`).send(writer).expect(201)
    await request(app).post(`${b}/identities/writer.md/votes`).send({ kind: 'small' }).expect(201)
    await request(app).post(`${b}/identities/writer.md/votes`).send({ kind: 'maybe' }).expect(400)
    const today = await request(app).get(`${b}/today`).expect(200)
    expect(today.body.rows[0].vote).toMatchObject({ kind: 'small', source: 'tap' })
    expect(today.body.day.mode).toBe('open')
  })

  it('places identities on the calendar', async () => {
    await request(app).post(`${b}/identities`).send(writer).expect(201)
    const res = await request(app).get(`${b}/slots?from=2026-09-28&to=2026-09-30`).expect(200)
    expect(res.body.slots.map((s: { start: string }) => s.start)).toEqual(['2026-09-28T06:30', '2026-09-29T06:30'])
  })

  it('shows the week before the Mirror is written, and 404s the Mirror itself', async () => {
    await request(app).post(`${b}/identities`).send(writer).expect(201)
    const week = await request(app).get(`${b}/week?week=2026-W39`).expect(200)
    expect(week.body).toMatchObject({ week: '2026-W39', from: '2026-09-21' })
    await request(app).get(`${b}/week?week=soon`).expect(400)
    await request(app).get(`${b}/mirrors/2026-W39`).expect(404)
    expect((await request(app).get(`${b}/mirrors`).expect(200)).body).toEqual([])
  })

  it('sets up the weekly Mirror job once', async () => {
    await request(app).post(`${b}/mirror-job`).expect(201)
    const again = await request(app).post(`${b}/mirror-job`)
    expect(again.status).toBe(409)
  })
})
