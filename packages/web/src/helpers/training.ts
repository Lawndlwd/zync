import type {
  Equipment,
  Exercise,
  Experience,
  Goal,
  LoggedSet,
  PlannedSet,
  ProfileInput,
  Routine,
  RoutineExercise,
  Sex,
  TrainingDay,
  TrainingProfile,
  Units,
  WeekDayCell,
  WorkoutExercise,
} from '../types/training'
import { MONTHS, pad2, startOfWeek, ymd, addDays } from './dates'
import { plural } from './format'

// Training in words and numbers: labels, kg ⇄ lb, workout math, the rest timer, calendars, charts.

export const TRAINING_DAYS: TrainingDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const GOALS: Goal[] = ['build_muscle', 'strength', 'lose_fat', 'endurance', 'general_fitness']
export const GOAL_LABEL: Record<Goal, string> = {
  lose_fat: 'Lose fat',
  build_muscle: 'Build muscle',
  strength: 'Get stronger',
  endurance: 'Endurance',
  general_fitness: 'General fitness',
}

export const EXPERIENCES: Experience[] = ['beginner', 'intermediate', 'advanced']
export const EXPERIENCE_LABEL: Record<Experience, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export const EQUIPMENT: Equipment[] = [
  'bodyweight',
  'bands',
  'dumbbells',
  'kettlebells',
  'pull_up_bar',
  'barbell',
  'machines',
  'gym',
]
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: 'Bodyweight',
  bands: 'Bands',
  dumbbells: 'Dumbbells',
  kettlebells: 'Kettlebells',
  pull_up_bar: 'Pull-up bar',
  barbell: 'Barbell',
  machines: 'Machines',
  gym: 'Full gym',
}

export const DAYS_PER_WEEK = [2, 3, 4, 5, 6, 7]
export const SESSION_MINUTES = [30, 45, 60, 75, 90]

/** The statement of the Becoming identity the setup can create. */
export const TRAINING_IDENTITY = 'I am someone who trains'

// kg ⇄ lb. Weights are stored in kg; `units` only changes what the user reads and types.

const KG_PER_LB = 0.45359237

const round1 = (n: number) => Math.round(n * 10) / 10

/** A stored kg value in the user's units. */
export const toUnits = (kg: number, units: Units) => (units === 'kg' ? kg : kg / KG_PER_LB)

/** A value typed in the user's units, back to kg (to the gram, so 100 lb reads back as 100). */
export const fromUnits = (value: number, units: Units) =>
  units === 'kg' ? value : Math.round(value * KG_PER_LB * 1000) / 1000

/** "82.5", "100": a weight as typed in a set box; empty when there is none. */
export const weightText = (kg: number | undefined, units: Units) =>
  kg === undefined ? '' : String(round1(toUnits(kg, units)))

/** "82.5 kg", "182 lb". */
export const weightLabel = (kg: number, units: Units) => `${weightText(kg, units)} ${units}`

/** A session's or a week's volume: "850 kg", "6.2 t", "13,640 lb". */
export function volumeLabel(kg: number, units: Units): string {
  if (units === 'lb') return `${Math.round(toUnits(kg, 'lb')).toLocaleString('en-US')} lb`
  return kg >= 1000 ? `${round1(kg / 1000)} t` : `${Math.round(kg)} kg`
}

/** "+2.5 kg", "−1 lb". */
export function deltaLabel(kg: number, units: Units): string {
  const v = round1(toUnits(Math.abs(kg), units))
  return `${kg < 0 ? '−' : '+'}${v} ${units}`
}

/** A number typed in a box ("82,5" works too). Blank, negative or junk → undefined. */
export function parseAmount(text: string): number | undefined {
  const t = text.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** What was typed in a kg (in the user's units) or reps box, as stored: kg, or whole reps. */
export function amountFrom(text: string, key: 'kg' | 'reps', units: Units): number | undefined {
  const n = parseAmount(text)
  if (n === undefined) return undefined
  return key === 'kg' ? fromUnits(n, units) : Math.round(n)
}

/** The set with its weight or reps replaced; `undefined` removes it. */
export function withAmount<T extends PlannedSet>(set: T, key: 'kg' | 'reps', value: number | undefined): T {
  const next = { ...set }
  Reflect.deleteProperty(next, key)
  return value === undefined ? next : { ...next, [key]: value }
}

/** Rest lengths offered for an exercise, in seconds. */
export const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240]

/** "90 s", "2 min", "2 min 30". */
export function restOptionLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s ? `${m} min ${pad2(s)}` : `${m} min`
}

// A workout in numbers.

/** Done working sets (warm-ups don't count toward volume or PRs). */
const counts = (s: LoggedSet) => s.done && !s.warmup

/** Σ kg × reps over done working sets. */
export const volumeOf = (exercises: WorkoutExercise[]) =>
  exercises.reduce((sum, e) => sum + e.sets.reduce((s, x) => s + (counts(x) ? (x.kg ?? 0) * (x.reps ?? 0) : 0), 0), 0)

/** Sets ticked off, out of all sets: "X of Y sets". */
export function setProgress(exercises: WorkoutExercise[]): { done: number; total: number } {
  const all = exercises.flatMap((e) => e.sets)
  return { done: all.filter((s) => s.done).length, total: all.length }
}

/** A new set under the last one: same weight and reps, not done yet. */
export function nextSet(sets: LoggedSet[]): LoggedSet {
  const last = sets.at(-1)
  return {
    ...(last?.kg !== undefined ? { kg: last.kg } : {}),
    ...(last?.reps !== undefined ? { reps: last.reps } : {}),
    done: false,
  }
}

/** A new planned set under the last one. */
export function nextPlannedSet(sets: PlannedSet[]): PlannedSet {
  const last = sets.at(-1)
  return {
    ...(last?.kg !== undefined ? { kg: last.kg } : {}),
    ...(last?.reps !== undefined ? { reps: last.reps } : {}),
  }
}

/** A set ticked off: blank weight or reps are taken from last time's set. */
export function completeSet(set: LoggedSet, previous: PlannedSet | undefined): LoggedSet {
  const kg = set.kg ?? previous?.kg
  const reps = set.reps ?? previous?.reps
  return { ...set, done: true, ...(kg === undefined ? {} : { kg }), ...(reps === undefined ? {} : { reps }) }
}

/** "Previous" cell: "80 kg × 8", or "—". */
export function previousText(prev: PlannedSet | undefined, units: Units): string {
  if (!prev || (prev.kg === undefined && prev.reps === undefined)) return '—'
  if (prev.kg === undefined) return `${prev.reps ?? 0} reps`
  return `${weightLabel(prev.kg, units)} × ${prev.reps ?? 0}`
}

/** Done sets in one line: "80×8 · 80×8 · 82.5×6" (weights in the user's units), warm-ups left out. */
export function setsText(sets: LoggedSet[], units: Units): string {
  const done = sets.filter(counts)
  if (done.length === 0) return 'no sets done'
  return done
    .map((s) => (s.kg === undefined ? `${s.reps ?? 0} reps` : `${weightText(s.kg, units)}×${s.reps ?? 0}`))
    .join(' · ')
}

/** An exercise added to a live workout: one empty set. */
export const workoutExerciseOf = (ex: Exercise): WorkoutExercise => ({
  exercise: ex.id,
  name: ex.name,
  sets: [{ done: false }],
})

// Clocks and the rest timer. The timer keeps the moment rest ends (not a countdown), so a tab that
// slept or a slow render never makes it drift.

export const DEFAULT_REST = 90

/** "4:05", "1:02:05". */
export function clockLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = pad2(s % 60)
  return h > 0 ? `${h}:${pad2(m)}:${sec}` : `${m}:${sec}`
}

/** Whole seconds since `startedAt` (ISO), never negative. */
export const elapsedSeconds = (startedAt: string, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))

/** Seconds of rest left, rounded up (shows 0:01 until it's really over). */
export const restLeft = (endsAt: number, now: number) => Math.max(0, Math.ceil((endsAt - now) / 1000))

/** Rest ending `seconds` later; once it has run out, the extra time counts from now. */
export const extendRest = (endsAt: number, now: number, seconds: number) => Math.max(endsAt, now) + seconds * 1000

/** "48 min", "1 h 12". */
export function minutesLabel(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${pad2(m % 60)}`
}

// Days and weeks. The training week starts on Monday.

export const weekdayOf = (date: string): TrainingDay =>
  TRAINING_DAYS[(new Date(`${date}T00:00`).getDay() + 6) % 7] ?? 'Mon'

export type WeekCell = {
  date: string
  day: TrainingDay
  /** Day of the month. */
  n: number
  trained: boolean
  planned: boolean
  today: boolean
  future: boolean
}

/** The week strip on Today: each day, whether it was trained, and whether a routine falls on it. */
export function weekCells(days: WeekDayCell[], today: string, routines: Routine[]): WeekCell[] {
  const plannedDays = new Set(routines.flatMap((r) => r.days))
  return days.map((d) => {
    const day = weekdayOf(d.date)
    return {
      date: d.date,
      day,
      n: Number(d.date.slice(8, 10)),
      trained: d.trained,
      planned: plannedDays.has(day),
      today: d.date === today,
      future: d.date > today,
    }
  })
}

/** A week-strip day in words. */
export function weekCellText(c: WeekCell): string {
  if (c.trained) return 'trained'
  if (c.future || c.today) return c.planned ? 'planned' : 'rest'
  return c.planned ? 'planned, missed' : 'rest'
}

/** "Mon · Thu", in week order; "Any day" when none. */
export function daysText(days: TrainingDay[]): string {
  const set = new Set(days)
  const list = TRAINING_DAYS.filter((d) => set.has(d))
  return list.length ? list.join(' · ') : 'Any day'
}

/** Adds or removes a weekday, keeping week order. */
export function toggleDay(days: TrainingDay[], day: TrainingDay): TrainingDay[] {
  const set = new Set(days)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  return TRAINING_DAYS.filter((d) => set.has(d))
}

// Routines.

/** "5 exercises · 15 sets · Mon · Thu". */
export function routineSummary(r: Routine): string {
  const sets = r.exercises.reduce((n, e) => n + e.sets.length, 0)
  return `${plural(r.exercises.length, 'exercise')} · ${plural(sets, 'set')} · ${daysText(r.days)}`
}

export type RoutineGroup = { folder: string; routines: Routine[] }

/** Routines by folder (A→Z), the ones outside any folder last. */
export function byFolder(routines: Routine[]): RoutineGroup[] {
  const groups = new Map<string, Routine[]>()
  for (const r of routines) {
    const key = r.folder ?? ''
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.entries()]
    .toSorted(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([folder, list]) => ({ folder, routines: list.toSorted((a, b) => a.name.localeCompare(b.name)) }))
}

/** `list` with the item at `from` moved to `to` (out-of-range moves change nothing). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item === undefined) return list
  next.splice(to, 0, item)
  return next
}

const DEFAULT_SCHEME = '3×8-12 · 90s'

/** An exercise added to a routine: three sets of 8, 90 s rest. */
export const routineExerciseOf = (ex: Exercise): RoutineExercise => ({
  exercise: ex.id,
  name: ex.name,
  scheme: DEFAULT_SCHEME,
  rest: DEFAULT_REST,
  sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }],
})

// The Log's month calendar.

/** "2026-09" of a "YYYY-MM-DD". */
export const monthOf = (date: string) => date.slice(0, 7)

export function shiftMonth(month: string, n: number): string {
  const [y = 1970, m = 1] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

/** "September 2026". */
export function monthLabel(month: string): string {
  const [y = 1970, m = 1] = month.split('-').map(Number)
  return `${MONTHS[m - 1] ?? ''} ${y}`
}

/** Whole weeks (Monday first) covering the month: each day and whether it belongs to the month. */
export function monthCells(month: string): Array<{ date: string; inMonth: boolean }> {
  const [y = 1970, m = 1] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  const start = startOfWeek(first)
  const out: Array<{ date: string; inMonth: boolean }> = []
  for (let d = start; d <= last || out.length % 7 !== 0; d = addDays(d, 1))
    out.push({ date: ymd(d), inMonth: d.getMonth() === m - 1 })
  return out
}

// Charts.

/** Each value as a share of the largest (0 when all are 0). */
export function shares(values: number[]): number[] {
  const max = Math.max(0, ...values)
  return values.map((v) => (max > 0 ? v / max : 0))
}

/** SVG polyline points for a trend, `pad` px inside a `w`×`h` box; a flat series sits in the middle. */
export function trendPoints(values: number[], w: number, h: number, pad = 4): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = values.length > 1 ? (w - 2 * pad) / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const x = values.length > 1 ? pad + i * step : w / 2
      const y = max === min ? h / 2 : pad + (1 - (v - min) / (max - min)) * (h - 2 * pad)
      return `${round1(x)},${round1(y)}`
    })
    .join(' ')
}

// The setup form. Numbers are kept as typed until the profile is saved.

export type ProfileDraft = {
  units: Units
  sex?: Sex | undefined
  birthYear: string
  heightCm: string
  /** Body weight in the chosen units, logged when the setup is saved. */
  weight: string
  goal?: Goal | undefined
  experience?: Experience | undefined
  equipment: Equipment[]
  injuries: string
  daysPerWeek?: number | undefined
  sessionMinutes?: number | undefined
}

export function draftOf(p: TrainingProfile | null): ProfileDraft {
  if (!p) return { units: 'kg', birthYear: '', heightCm: '', weight: '', equipment: [], injuries: '' }
  return {
    units: p.units,
    ...(p.sex ? { sex: p.sex } : {}),
    birthYear: p.birthYear === undefined ? '' : String(p.birthYear),
    heightCm: p.heightCm === undefined ? '' : String(p.heightCm),
    weight: '',
    goal: p.goal,
    ...(p.experience ? { experience: p.experience } : {}),
    equipment: p.equipment,
    injuries: p.injuries ?? '',
    daysPerWeek: p.daysPerWeek,
    ...(p.sessionMinutes === undefined ? {} : { sessionMinutes: p.sessionMinutes }),
  }
}

export const SETUP_STEPS = ['You', 'Goal', 'Equipment', 'Schedule', 'Finish'] as const

/** What stops the user from leaving step `step`, or null when it's complete. */
export function stepProblem(step: number, d: ProfileDraft, thisYear: number): string | null {
  switch (step) {
    case 0: {
      const year = d.birthYear.trim() ? parseAmount(d.birthYear) : 0
      if (year === undefined || (year !== 0 && (year < 1900 || year > thisYear)))
        return 'Birth year is a year like 1990.'
      if (d.heightCm.trim() && !parseAmount(d.heightCm)) return 'Height is a number of centimetres.'
      if (d.weight.trim() && !parseAmount(d.weight)) return `Weight is a number of ${d.units}.`
      return null
    }
    case 1:
      return d.goal ? null : 'Pick a goal.'
    case 2:
      return d.equipment.length > 0 ? null : 'Pick at least one kind of equipment (bodyweight counts).'
    case 3:
      return d.daysPerWeek ? null : 'Pick how many days a week you train.'
    default:
      return null
  }
}

/** The profile to save, or null while a required answer is missing. */
export function profileOf(d: ProfileDraft): ProfileInput | null {
  if (!d.goal || !d.daysPerWeek || d.equipment.length === 0) return null
  const birthYear = parseAmount(d.birthYear)
  const heightCm = parseAmount(d.heightCm)
  const injuries = d.injuries.trim()
  return {
    goal: d.goal,
    equipment: d.equipment,
    daysPerWeek: d.daysPerWeek,
    units: d.units,
    ...(d.experience ? { experience: d.experience } : {}),
    ...(injuries ? { injuries } : {}),
    ...(d.sessionMinutes ? { sessionMinutes: d.sessionMinutes } : {}),
    ...(d.sex ? { sex: d.sex } : {}),
    ...(birthYear ? { birthYear: Math.round(birthYear) } : {}),
    ...(heightCm ? { heightCm } : {}),
  }
}

/** Body weight typed in the setup, in kg (undefined when left blank). */
export function draftWeightKg(d: ProfileDraft): number | undefined {
  const w = parseAmount(d.weight)
  return w ? fromUnits(w, d.units) : undefined
}
