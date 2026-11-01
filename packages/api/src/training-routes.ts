import {
  addBodyWeight,
  createCustomExercise,
  createRoutine,
  deleteRoutine,
  deleteWorkout,
  exerciseDetail,
  finishWorkout,
  httpError,
  listRoutines,
  listWorkouts,
  type OpencodeClient,
  PLAN_PROMPT,
  PROGRESS_RANGES,
  type ProgressRange,
  readProfile,
  readRoutine,
  readWorkout,
  saveProfile,
  searchExercises,
  startWorkout,
  trainingProgress,
  trainingToday,
  updateRoutine,
  updateWorkout,
} from '@zync/jobs'
import express, { Router } from 'express'

import {
  BodyWeightBody,
  CustomExerciseBody,
  RoutineBody,
  RoutinePatchBody,
  TrainingProfileBody,
  WorkoutBody,
  WorkoutStartBody,
} from './body.js'
import { wsOf } from './workspace-param.js'

const MONTH = /^\d{4}-\d{2}$/
const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)
const int = (v: unknown, fallback: number, min: number, max: number) =>
  Math.min(Math.max(Number.parseInt(typeof v === 'string' ? v : '', 10) || fallback, min), max)
const isRange = (v: unknown): v is ProgressRange => PROGRESS_RANGES.some((r) => r === v)

/** Training: profile, exercise library, routines, the workout log and progress, in Training/. */
export function trainingRoutes(opencode?: OpencodeClient): Router {
  const r = Router({ mergeParams: true })
  r.use(express.json({ limit: '1mb' }))

  r.get('/profile', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readProfile(ws.path))
  })

  r.put('/profile', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await saveProfile(ws.path, TrainingProfileBody.parse(req.body)))
  })

  r.get('/exercises', async (req, res) => {
    const ws = await wsOf(req)
    const q = str(req.query.q)
    const muscle = str(req.query.muscle)
    const equipment = str(req.query.equipment)
    res.json(
      await searchExercises(ws.path, {
        ...(q ? { q } : {}),
        ...(muscle ? { muscle } : {}),
        ...(equipment ? { equipment } : {}),
        limit: int(req.query.limit, 30, 1, 200),
        offset: int(req.query.offset, 0, 0, 100_000),
      }),
    )
  })

  r.get('/exercises/:id', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await exerciseDetail(ws.path, req.params.id))
  })

  r.post('/exercises', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await createCustomExercise(ws.path, CustomExerciseBody.parse(req.body)))
  })

  r.get('/routines', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await listRoutines(ws.path))
  })

  r.post('/routines', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await createRoutine(ws.path, RoutineBody.parse(req.body)))
  })

  r.get('/routines/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readRoutine(ws.path, req.params.file))
  })

  r.patch('/routines/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await updateRoutine(ws.path, req.params.file, RoutinePatchBody.parse(req.body)))
  })

  r.delete('/routines/:file', async (req, res) => {
    const ws = await wsOf(req)
    await deleteRoutine(ws.path, req.params.file)
    res.status(204).end()
  })

  r.get('/today', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await trainingToday(ws.path))
  })

  r.post('/workouts', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await startWorkout(ws.path, WorkoutStartBody.parse(req.body ?? {})))
  })

  r.get('/workouts', async (req, res) => {
    const ws = await wsOf(req)
    const month = str(req.query.month)
    res.json(await listWorkouts(ws.path, month && MONTH.test(month) ? month : undefined))
  })

  r.get('/workouts/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await readWorkout(ws.path, req.params.file))
  })

  r.put('/workouts/:file', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await updateWorkout(ws.path, req.params.file, WorkoutBody.parse(req.body)))
  })

  r.post('/workouts/:file/finish', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await finishWorkout(ws.path, req.params.file))
  })

  r.delete('/workouts/:file', async (req, res) => {
    const ws = await wsOf(req)
    await deleteWorkout(ws.path, req.params.file)
    res.status(204).end()
  })

  r.get('/progress', async (req, res) => {
    const ws = await wsOf(req)
    res.json(await trainingProgress(ws.path, isRange(req.query.range) ? req.query.range : '8w'))
  })

  r.post('/body', async (req, res) => {
    const ws = await wsOf(req)
    res.status(201).json(await addBodyWeight(ws.path, BodyWeightBody.parse(req.body)))
  })

  // "Build my plan with the AI": a chat session that turns the profile into routines.
  r.post('/plan', async (req, res) => {
    const ws = await wsOf(req)
    if (!opencode) throw httpError(503, 'The AI server is not configured')
    if (!(await readProfile(ws.path))) throw httpError(409, 'Set up your training profile first')
    const sessionId = await opencode.createSession(ws.path, 'Training plan')
    await opencode.promptAsync(sessionId, PLAN_PROMPT)
    res.status(201).json({ sessionId })
  })

  return r
}
