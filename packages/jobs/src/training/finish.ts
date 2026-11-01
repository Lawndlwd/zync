import { evidenceFor } from '../becoming/evidence.js'
import { appendProof, listIdentities } from '../becoming/store.js'
import { appendVote, readVotes, standingVotes, voteKey } from '../becoming/votes.js'
import { votesOnWorkouts, workoutsDone } from '../becoming/workouts.js'
import { conflict, notFound } from '../errors.js'
import { addDays, instantOf, localStamp } from '../helpers/dates.js'
import { assertKnownExercises, findExercise } from './exercises.js'
import { recordsOf } from './records.js'
import { readRoutine } from './routines.js'
import { localDay, targetOf } from './stats.js'
import {
  type FinishResult,
  type LogWorkoutInput,
  LogWorkoutSchema,
  type TrainingVote,
  type WorkoutExercise,
  type WorkoutRecord,
} from './types.js'
import { freeWorkoutFile, readWorkouts, withPrevious, workoutName, writeWorkout } from './workouts.js'

/**
 * Vote, right away, for every identity that counts workouts, from the day's finished workouts. A
 * vote the user cast is never replaced, and an automatic full vote is never lowered to small.
 * Returns the identities the day's workouts vote for.
 */
export async function castWorkoutVotes(wsPath: string, date: string, now = localStamp()): Promise<TrainingVote[]> {
  const [identities, votes, workouts] = await Promise.all([
    listIdentities(wsPath),
    readVotes(wsPath),
    workoutsDone(wsPath, date, addDays(date, 1)),
  ])
  const standing = standingVotes(votes)
  const out: TrainingVote[] = []
  for (const identity of identities) {
    if (!votesOnWorkouts(identity) || identity.since === '' || date < identity.since) continue
    const was = standing.get(voteKey(date, identity.file))
    if (was && was.source !== 'auto') continue
    const seen = evidenceFor(identity, { date, activity: [], events: [], now, workouts })
    if (!seen) continue
    if (was && ((was.kind === 'full' && seen.kind === 'small') || (was.kind === seen.kind && was.note === seen.note))) {
      out.push({ identity: identity.file, kind: was.kind })
      continue
    }
    await appendVote(wsPath, { date, identity: identity.file, kind: seen.kind, source: 'auto', note: seen.note })
    await appendProof(wsPath, identity.file, [{ date, text: seen.note, source: 'auto' }])
    out.push({ identity: identity.file, kind: seen.kind })
  }
  return out
}

/** A workout just recorded as finished: its personal records and the Becoming votes it cast. */
async function recordFinish(wsPath: string, record: WorkoutRecord): Promise<FinishResult> {
  const all = await readWorkouts(wsPath)
  return {
    workout: withPrevious(all, record),
    prs: recordsOf(all, record),
    votes: await castWorkoutVotes(wsPath, localDay(record.startedAt)),
  }
}

/** End the workout in progress now: records, and a Becoming vote for identities that count workouts. */
export async function finishWorkout(wsPath: string, file: string, now = new Date()): Promise<FinishResult> {
  const all = await readWorkouts(wsPath)
  const current = all.find((w) => w.file === file)
  if (!current) throw notFound(`Unknown workout "${file}"`)
  if (current.endedAt !== undefined) throw conflict(`${current.name} is already finished`)
  const endedAt = new Date(Math.max(now.getTime(), Date.parse(current.startedAt))).toISOString()
  const record: WorkoutRecord = { ...current, endedAt }
  await writeWorkout(wsPath, record)
  return recordFinish(wsPath, record)
}

const DEFAULT_TIME = '18:00'
const DEFAULT_MINUTES = 45

/** Record a past workout from chat (finished, every set done), with its records and votes. */
export async function logWorkout(wsPath: string, raw: LogWorkoutInput): Promise<FinishResult> {
  const input = LogWorkoutSchema.parse(raw)
  const routine = input.routine ? await readRoutine(wsPath, input.routine) : null
  const named = await Promise.all(
    input.exercises.map(async (e) => ({
      ...e,
      name: e.name ?? (await findExercise(wsPath, e.exercise))?.name ?? e.exercise,
    })),
  )
  await assertKnownExercises(wsPath, named)
  const date = input.date ?? localStamp().slice(0, 10)
  const start = instantOf(`${date}T${input.time ?? DEFAULT_TIME}`)
  const startedAt = start.toISOString()
  const endedAt = new Date(start.getTime() + (input.minutes ?? DEFAULT_MINUTES) * 60_000).toISOString()
  const exercises: WorkoutExercise[] = named.map((e) => ({
    exercise: e.exercise,
    name: e.name,
    sets: e.sets.map((s) => Object.assign(targetOf(s), { done: true }, s.warmup ? { warmup: true } : {})),
  }))
  const record: WorkoutRecord = {
    file: await freeWorkoutFile(wsPath, date, workoutName(routine?.file)),
    name: workoutName(routine?.file),
    ...(routine ? { routine: routine.file } : {}),
    startedAt,
    endedAt,
    exercises,
    notes: input.notes?.trim() ?? '',
  }
  await writeWorkout(wsPath, record)
  return recordFinish(wsPath, record)
}
