import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { castVote } from '../becoming/cast.js'
import { createIdentity, readIdentity } from '../becoming/store.js'
import { readVotes, standingVotes, voteKey } from '../becoming/votes.js'
import { localStamp } from '../helpers/dates.js'
import { finishWorkout, logWorkout } from './finish.js'
import { startWorkout, updateWorkout } from './workouts.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'zync-training-'))
})

const trainer = {
  statement: 'I am someone who trains',
  action: 'Train',
  signals: [{ workout: { minMinutes: 30 } }],
}
const bench = { exercise: 'ed-0025', name: 'Barbell Bench Press' }

/** A workout of `minutes` from noon UTC on a day, with 3 × 10 × 100 kg done. */
async function train(day: string, minutes: number) {
  const start = new Date(`${day}T12:00:00Z`)
  const w = await startWorkout(ws, {}, start)
  await updateWorkout(ws, w.file, {
    exercises: [{ ...bench, sets: [1, 2, 3].map(() => ({ kg: 100, reps: 10, done: true })) }],
  })
  return finishWorkout(ws, w.file, new Date(start.getTime() + minutes * 60_000))
}

const localDate = (iso: string) => localStamp(new Date(iso)).slice(0, 10)

describe('finishing a workout votes for Becoming', () => {
  it('casts a full automatic vote with a proof line', async () => {
    await createIdentity(ws, trainer, '2026-09-01')
    const { votes } = await train('2026-09-28', 48)
    expect(votes).toEqual([{ identity: 'someone-who-trains.md', kind: 'full' }])
    const day = localDate('2026-09-28T12:00:00Z')
    expect(standingVotes(await readVotes(ws)).get(voteKey(day, 'someone-who-trains.md'))).toEqual({
      kind: 'full',
      source: 'auto',
      note: 'Workout · 48 min · 3 t',
    })
    expect((await readIdentity(ws, 'someone-who-trains.md')).proof[0]).toEqual({
      date: day,
      text: 'Workout · 48 min · 3 t',
      source: 'auto',
    })
  })

  it('counts a short workout as a small vote, and a longer one later that day upgrades it', async () => {
    await createIdentity(ws, trainer, '2026-09-01')
    expect((await train('2026-09-28', 15)).votes).toEqual([{ identity: 'someone-who-trains.md', kind: 'small' }])
    const later = await logWorkout(ws, {
      date: localDate('2026-09-28T12:00:00Z'),
      time: '20:00',
      minutes: 40,
      exercises: [{ exercise: 'ed-0025', sets: [{ kg: 100, reps: 5 }] }],
    })
    expect(later.votes).toEqual([{ identity: 'someone-who-trains.md', kind: 'full' }])
  })

  it('never replaces a vote the user cast', async () => {
    await createIdentity(ws, trainer, '2026-09-01')
    const day = localDate('2026-09-28T12:00:00Z')
    await castVote(ws, 'someone-who-trains.md', day, 'small', 'tap')
    expect((await train('2026-09-28', 60)).votes).toEqual([])
    expect(standingVotes(await readVotes(ws)).get(voteKey(day, 'someone-who-trains.md'))).toMatchObject({
      kind: 'small',
      source: 'tap',
    })
  })

  it('leaves identities without a workout signal alone', async () => {
    await createIdentity(
      ws,
      { statement: 'I am a writer', action: 'Write', signals: [{ files: 'Writing/' }] },
      '2026-09-01',
    )
    expect((await train('2026-09-28', 60)).votes).toEqual([])
    expect(await readVotes(ws)).toEqual([])
  })
})

describe('logWorkout', () => {
  it('records a past workout, finished, every set done', async () => {
    const { workout, prs } = await logWorkout(ws, {
      date: '2026-09-20',
      time: '18:30',
      minutes: 50,
      exercises: [{ exercise: 'ed-0025', sets: [{ kg: 80, reps: 5 }] }],
    })
    expect(workout.file).toBe('2026-09-20-workout.md')
    expect(workout.exercises[0]).toMatchObject({ name: 'Barbell Bench Press', sets: [{ kg: 80, reps: 5, done: true }] })
    expect(localStamp(new Date(workout.startedAt))).toBe('2026-09-20T18:30')
    expect(prs).toHaveLength(1)
    expect(await readFile(path.join(ws, 'Training/Log', workout.file), 'utf8')).toContain('endedAt')
  })

  it('rejects an invented exercise id', async () => {
    await expect(
      logWorkout(ws, { exercises: [{ exercise: 'bench-press', name: 'Bench press', sets: [{ reps: 5 }] }] }),
    ).rejects.toThrow(/unknown exercise id "bench-press"/)
  })
})
