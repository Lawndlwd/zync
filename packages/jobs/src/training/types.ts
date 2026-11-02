import { z } from 'zod'

import { dayField } from '../helpers/dates.js'

// Training: the user's gym log, one file per record, weights always in kg.
//
//   <ws>/Training/profile.md                   goal, equipment, days per week… (missing = not set up)
//   <ws>/Training/Routines/Push Day.md         a routine: days, exercises with targets; title = file name
//   <ws>/Training/Log/2026-09-29-push-day.md   one workout; no `endedAt` = in progress (one at a time)
//   <ws>/Training/Exercises/<slug>.md          a custom exercise, id "custom:<slug>"
//   <ws>/Training/.body.jsonl                  body weight, one line per entry, last per date wins

export const TRAINING_DIR = 'Training'
export const ROUTINES_DIR = `${TRAINING_DIR}/Routines`
export const LOG_DIR = `${TRAINING_DIR}/Log`
export const EXERCISES_DIR = `${TRAINING_DIR}/Exercises`
export const PROFILE_FILE = `${TRAINING_DIR}/profile.md`
export const BODY_FILE = `${TRAINING_DIR}/.body.jsonl`

export const GOALS = ['lose_fat', 'build_muscle', 'strength', 'endurance', 'general_fitness'] as const
export const EXPERIENCES = ['beginner', 'intermediate', 'advanced'] as const
export const EQUIPMENT = [
  'bodyweight',
  'bands',
  'dumbbells',
  'kettlebells',
  'pull_up_bar',
  'barbell',
  'machines',
  'gym',
] as const
export type EquipmentTag = (typeof EQUIPMENT)[number]
export const UNITS = ['kg', 'lb'] as const
export const SEXES = ['male', 'female'] as const
/** Training weekdays, Monday first (the week starts on Monday). */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export type Day = (typeof DAYS)[number]

/** An optional field that also accepts `null` (YAML and AI output both say "null" for "none"). */
const opt = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === null ? undefined : v), schema.optional())

/** YAML turns an unquoted ISO time into a Date: back to the ISO string. */
const isoField = z.preprocess((v) => (v instanceof Date ? v.toISOString() : v), z.iso.datetime({ offset: true }))

const kg = z.number().min(0).max(2000)
const reps = z.number().int().min(0).max(1000)
const rest = z.number().int().min(0).max(900)

export const TrainingProfileInputSchema = z.object({
  goal: z.enum(GOALS),
  experience: opt(z.enum(EXPERIENCES)),
  equipment: z
    .array(z.enum(EQUIPMENT))
    .min(1)
    .transform((list) => [...new Set(list)]),
  injuries: opt(z.string().trim().max(500)),
  daysPerWeek: z.number().int().min(2).max(7),
  sessionMinutes: opt(z.number().int().min(10).max(300)),
  units: z.enum(UNITS).default('kg'),
  sex: opt(z.enum(SEXES)),
  birthYear: opt(z.number().int().min(1900).max(2100)),
  heightCm: opt(z.number().min(50).max(260)),
  /** The page body: free notes. */
  notes: opt(z.string().max(4000)),
})
export type TrainingProfileInput = z.input<typeof TrainingProfileInputSchema>

export type TrainingProfile = Omit<z.output<typeof TrainingProfileInputSchema>, 'notes'> & {
  setupAt: string
  notes: string
}

/** Frontmatter of profile.md (the body is `notes`). */
export const ProfileFileSchema = TrainingProfileInputSchema.omit({ notes: true }).extend({
  setupAt: isoField.catch(() => new Date(0).toISOString()),
})

export const TargetSetSchema = z.object({ kg: opt(kg), reps: opt(reps) })
export type TargetSet = z.output<typeof TargetSetSchema>

export const RoutineExerciseSchema = z.object({
  /** Catalog id ("ed-0025") or custom ("custom:<slug>"). */
  exercise: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  /** How to train it, e.g. "3×8-12 · 90s"; the rep range drives progression. */
  scheme: z.string().trim().max(60).default(''),
  rest: opt(rest),
  sets: z.array(TargetSetSchema).max(20).default([]),
})
export type RoutineExercise = z.output<typeof RoutineExerciseSchema>

const daysField = z
  .array(z.enum(DAYS))
  .max(7)
  .transform((list) => DAYS.filter((d) => list.includes(d)))

export type Routine = {
  /** File name inside Training/Routines/, e.g. "Push Day.md". */
  file: string
  /** The title: the file name without ".md". */
  name: string
  days: Day[]
  folder?: string
  exercises: RoutineExercise[]
  /** The page body. */
  notes: string
}

/** Frontmatter of a routine page (the body is `notes`). */
export const RoutineFileSchema = z.object({
  days: daysField.catch([]),
  folder: opt(z.string().trim().min(1).max(80)).catch(undefined),
  exercises: z.array(z.unknown()).catch([]),
})

const routineName = z.string().trim().min(1).max(80)

export const RoutineInputSchema = z.object({
  name: routineName,
  days: daysField.optional(),
  folder: opt(z.string().trim().min(1).max(80)),
  exercises: z.array(RoutineExerciseSchema).max(40).optional(),
  notes: z.string().max(8000).optional(),
})
export type RoutineInput = z.input<typeof RoutineInputSchema>

export const RoutinePatchSchema = z.object({
  name: routineName.optional(),
  days: daysField.optional(),
  folder: z.string().trim().min(1).max(80).nullable().optional(),
  exercises: z.array(RoutineExerciseSchema).max(40).optional(),
  notes: z.string().max(8000).optional(),
})
export type RoutinePatch = z.input<typeof RoutinePatchSchema>

export const WorkoutSetSchema = z.object({
  kg: opt(kg),
  reps: opt(reps),
  done: z.boolean().default(false),
  warmup: opt(z.boolean()),
})
export type WorkoutSet = z.output<typeof WorkoutSetSchema>

export const WorkoutExerciseSchema = z.object({
  exercise: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  note: opt(z.string().max(500)),
  rest: opt(rest),
  sets: z.array(WorkoutSetSchema).max(40).default([]),
})
export type WorkoutExercise = z.output<typeof WorkoutExerciseSchema>

/** Frontmatter of a workout page (the body is `notes`). */
export const WorkoutFileSchema = z.object({
  routine: opt(z.string().min(1)).catch(undefined),
  startedAt: isoField,
  endedAt: opt(isoField).catch(undefined),
  exercises: z.array(z.unknown()).catch([]),
})

/** A workout as stored. */
export type WorkoutRecord = {
  /** File name inside Training/Log/, e.g. "2026-09-29-push-day.md". */
  file: string
  /** The routine's name, or "Workout". */
  name: string
  /** The routine file it was started from. */
  routine?: string
  startedAt: string
  /** Absent while the workout is in progress. */
  endedAt?: string
  exercises: WorkoutExercise[]
  notes: string
}

/** What each exercise's sets were the last time (done, non-warm-up sets). */
export type PreviousSets = Record<string, TargetSet[]>

export type Workout = WorkoutRecord & { previous: PreviousSets }

export const WorkoutUpdateSchema = z.object({
  exercises: z.array(WorkoutExerciseSchema).max(40),
  notes: z.string().max(8000).optional(),
})
export type WorkoutUpdate = z.input<typeof WorkoutUpdateSchema>

export const WorkoutStartSchema = z.object({ routine: z.string().min(1).optional() })

export type WorkoutSummary = {
  file: string
  name: string
  /** The local day it started, "YYYY-MM-DD". */
  date: string
  /** 0 while in progress. */
  durationMin: number
  exercises: number
  /** Done, non-warm-up sets. */
  sets: number
  volumeKg: number
  muscles: string[]
  active: boolean
}

export type Exercise = {
  /** "ed-<datasetId>" for the catalog, "custom:<slug>" for the user's own. */
  id: string
  name: string
  muscleGroup: string
  equipment: string
  target?: string
  secondary: string[]
  instructions: string[]
  image?: string
  gif?: string
  custom: boolean
}

export const CustomExerciseInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.string().trim().min(1).max(40),
  equipment: z.string().trim().min(1).max(40),
  target: opt(z.string().trim().min(1).max(40)),
  secondary: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  instructions: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  gif: opt(z.url()),
})
export type CustomExerciseInput = z.input<typeof CustomExerciseInputSchema>

/** Frontmatter of a custom exercise page (the body is one step per line). */
export const CustomExerciseFileSchema = z.object({
  muscleGroup: z.string().catch('Other'),
  equipment: z.string().catch('Other'),
  target: opt(z.string()).catch(undefined),
  secondary: z.array(z.string()).catch([]),
  gif: opt(z.string()).catch(undefined),
})

const day = dayField('must look like 2026-09-29')

export const BodyEntrySchema = z.object({ date: day, kg: z.number().min(20).max(400), at: z.string() })
export type BodyEntry = z.output<typeof BodyEntrySchema>

export const BodyInputSchema = z.object({ kg: BodyEntrySchema.shape.kg, date: day.optional() })

/** A set's best: the weight, reps, and the estimated one-rep max. */
export type Best = { kg: number; reps: number; e1rm: number }

export type PersonalRecord = Best & { exercise: string; name: string; previousE1rm?: number }

export type TrainingVote = { identity: string; kind: 'full' | 'small' }

export type FinishResult = { workout: Workout; prs: PersonalRecord[]; votes: TrainingVote[] }

export const PROGRESS_RANGES = ['8w', '6m', 'all'] as const
export type ProgressRange = (typeof PROGRESS_RANGES)[number]

/** A past workout told in chat: recorded finished, every set done. */
export const LogWorkoutSchema = z.object({
  date: day.optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'must look like 18:30' })
    .optional(),
  minutes: z.number().int().min(1).max(600).optional(),
  routine: z.string().min(1).optional(),
  exercises: z
    .array(
      z.object({
        exercise: z.string().trim().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        sets: z
          .array(z.object({ kg: opt(kg), reps: opt(reps), warmup: opt(z.boolean()) }))
          .min(1)
          .max(40),
      }),
    )
    .min(1)
    .max(40),
  notes: z.string().max(8000).optional(),
})
export type LogWorkoutInput = z.input<typeof LogWorkoutSchema>
