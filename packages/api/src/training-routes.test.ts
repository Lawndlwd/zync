import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'

import { createApp } from './app.js'

let app: ReturnType<typeof createApp>
const t = '/zync/api/ws/alpha/training'

beforeEach(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'api-training-'))
  await mkdir(path.join(root, 'alpha'))
  app = createApp({ workspacesRoot: root })
})

const profile = { goal: 'build_muscle', equipment: ['dumbbells', 'pull_up_bar'], daysPerWeek: 3, units: 'kg' }
const push = {
  name: 'Push Day',
  days: ['Mon', 'Thu'],
  exercises: [{ exercise: 'ed-0025', name: 'Barbell Bench Press', scheme: '3×8-12', sets: [{ kg: 60, reps: 8 }] }],
}

describe('training', () => {
  it('sets up the profile', async () => {
    expect((await request(app).get(`${t}/profile`).expect(200)).body).toBeNull()
    const saved = await request(app).put(`${t}/profile`).send(profile).expect(200)
    expect(saved.body).toMatchObject({ goal: 'build_muscle', daysPerWeek: 3 })
    expect(typeof saved.body.setupAt).toBe('string')
    await request(app)
      .put(`${t}/profile`)
      .send({ ...profile, equipment: [] })
      .expect(400)
    expect((await request(app).get(`${t}/today`).expect(200)).body.profile).toBe(true)
  })

  it('searches the library and shows an exercise', async () => {
    const found = await request(app).get(`${t}/exercises?q=bench%20press&limit=3`).expect(200)
    expect(found.body.items).toHaveLength(3)
    expect(found.body.muscles).toContain('Chest')
    const detail = await request(app).get(`${t}/exercises/ed-0025`).expect(200)
    expect(detail.body).toMatchObject({ exercise: { name: 'Barbell Bench Press' }, history: [], best: null })
    await request(app).get(`${t}/exercises/ed-nope`).expect(404)
    const custom = await request(app)
      .post(`${t}/exercises`)
      .send({ name: 'Landmine Press', muscleGroup: 'Shoulders', equipment: 'Barbell' })
      .expect(201)
    expect(custom.body.id).toBe('custom:landmine-press')
    await request(app).get(`${t}/exercises/custom:landmine-press`).expect(200)
  })

  it('manages routines', async () => {
    const made = await request(app).post(`${t}/routines`).send(push).expect(201)
    expect(made.body.file).toBe('Push Day.md')
    await request(app)
      .post(`${t}/routines`)
      .send({ name: 'X', exercises: [{ exercise: 'nope', name: 'Nope' }] })
      .expect(400)
    const renamed = await request(app).patch(`${t}/routines/Push%20Day.md`).send({ name: 'Push A' }).expect(200)
    expect(renamed.body.file).toBe('Push A.md')
    expect((await request(app).get(`${t}/routines`).expect(200)).body).toHaveLength(1)
    await request(app).get(`${t}/routines/..%2Fprofile.md`).expect(404)
    await request(app).delete(`${t}/routines/Push%20A.md`).expect(204)
  })

  it('runs a workout from start to finish', async () => {
    await request(app).post(`${t}/routines`).send(push).expect(201)
    const started = await request(app).post(`${t}/workouts`).send({ routine: 'Push Day.md' }).expect(201)
    const file: string = started.body.file
    expect(started.body.exercises[0].sets).toEqual([{ kg: 60, reps: 8, done: false }])
    await request(app).post(`${t}/workouts`).send({}).expect(409)
    expect((await request(app).get(`${t}/today`).expect(200)).body.active.file).toBe(file)

    const sets = [{ kg: 60, reps: 10, done: true }]
    const saved = await request(app)
      .put(`${t}/workouts/${file}`)
      .send({ exercises: [{ ...push.exercises[0], sets }], notes: 'Good' })
      .expect(200)
    expect(saved.body.notes).toBe('Good')
    await request(app).put(`${t}/workouts/${file}`).send({ exercises: 'x' }).expect(400)

    const done = await request(app).post(`${t}/workouts/${file}/finish`).expect(200)
    expect(done.body.prs).toEqual([{ exercise: 'ed-0025', name: 'Barbell Bench Press', kg: 60, reps: 10, e1rm: 80 }])
    expect(done.body.votes).toEqual([])
    expect(typeof done.body.workout.endedAt).toBe('string')
    await request(app).post(`${t}/workouts/${file}/finish`).expect(409)

    const month = file.slice(0, 7)
    const list = await request(app).get(`${t}/workouts?month=${month}`).expect(200)
    expect(list.body[0]).toMatchObject({ file, sets: 1, volumeKg: 600, muscles: ['Chest'], active: false })
    const detail = await request(app).get(`${t}/exercises/ed-0025`).expect(200)
    expect(detail.body.best).toEqual({ kg: 60, reps: 10, e1rm: 80 })

    const progress = await request(app).get(`${t}/progress?range=6m`).expect(200)
    expect(progress.body.volume).toHaveLength(6)
    expect(progress.body.prs).toHaveLength(1)
    await request(app).delete(`${t}/workouts/${file}`).expect(204)
    await request(app).get(`${t}/workouts/${file}`).expect(404)
  })

  it('votes for a Becoming identity that counts workouts', async () => {
    await request(app)
      .post('/zync/api/ws/alpha/becoming/identities')
      .send({ statement: 'I am someone who trains', action: 'Train', signals: [{ workout: {} }] })
      .expect(201)
    const started = await request(app).post(`${t}/workouts`).send({}).expect(201)
    const done = await request(app).post(`${t}/workouts/${started.body.file}/finish`).expect(200)
    expect(done.body.votes).toEqual([{ identity: 'someone-who-trains.md', kind: 'small' }])
  })

  it('logs body weight', async () => {
    const entry = await request(app).post(`${t}/body`).send({ kg: 80.4, date: '2026-09-28' }).expect(201)
    expect(entry.body).toMatchObject({ date: '2026-09-28', kg: 80.4 })
    await request(app).post(`${t}/body`).send({ kg: 'heavy' }).expect(400)
    const progress = await request(app).get(`${t}/progress?range=all`).expect(200)
    expect(progress.body.body).toEqual([{ date: '2026-09-28', kg: 80.4 }])
  })

  it('needs the AI server to build a plan', async () => {
    const res = await request(app).post(`${t}/plan`).expect(503)
    expect(res.body.error).toMatch(/AI server/)
  })
})
