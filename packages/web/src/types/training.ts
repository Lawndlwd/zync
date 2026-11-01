// Training: the profile, routines, workouts and exercises under Training/ (mirrors @zync/jobs
// training/ and the /training API). Weights are always stored in kg; `units` is only how they show.

export type Goal = 'lose_fat' | 'build_muscle' | 'strength' | 'endurance' | 'general_fitness'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Equipment =
  | 'bodyweight'
  | 'bands'
  | 'dumbbells'
  | 'kettlebells'
  | 'pull_up_bar'
  | 'barbell'
  | 'machines'
  | 'gym'
export type Units = 'kg' | 'lb'
export type Sex = 'male' | 'female'
export type TrainingDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

export type TrainingProfile = {
  goal: Goal
  experience?: Experience
  equipment: Equipment[]
  injuries?: string
  daysPerWeek: number
  sessionMinutes?: number
  units: Units
  sex?: Sex
  birthYear?: number
  heightCm?: number
  setupAt: string
  /** The page body: free notes. */
  notes: string
}

/** What `PUT /profile` takes: the profile without `setupAt`. */
export type ProfileInput = Omit<TrainingProfile, 'setupAt' | 'notes'> & { notes?: string }

export type Exercise = {
  /** `ed-<n>` from the catalog, `custom:<slug>` for the user's own. */
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

export type ExercisePage = { items: Exercise[]; total: number; muscles: string[]; equipment: string[] }

export type ExerciseQuery = { q: string; muscle: string; equipment: string; offset: number }

export type LoggedSet = { kg?: number; reps?: number; done: boolean; warmup?: boolean }

type Best = { kg: number; reps: number; e1rm: number }

export type ExerciseDetail = {
  exercise: Exercise
  history: Array<{ workout: string; date: string; sets: LoggedSet[] }>
  best: Best | null
}

export type ExerciseInput = {
  name: string
  muscleGroup: string
  equipment: string
  target?: string
  secondary?: string[]
  instructions?: string[]
}

export type PlannedSet = { kg?: number; reps?: number }

export type RoutineExercise = {
  exercise: string
  name: string
  /** e.g. "3×8-12 · 90s". */
  scheme: string
  /** Rest between sets, in seconds. */
  rest?: number
  sets: PlannedSet[]
}

export type Routine = {
  file: string
  name: string
  days: TrainingDay[]
  folder?: string
  exercises: RoutineExercise[]
  notes: string
}

export type RoutineInput = { name: string; days?: TrainingDay[]; exercises?: RoutineExercise[] }

/** `folder: null` takes the routine out of its folder. */
export type RoutinePatch = {
  name?: string
  days?: TrainingDay[]
  folder?: string | null
  exercises?: RoutineExercise[]
  notes?: string
}

export type WorkoutExercise = {
  exercise: string
  name: string
  note?: string
  rest?: number
  sets: LoggedSet[]
}

export type Workout = {
  file: string
  name: string
  routine?: string
  startedAt: string
  /** Absent while the workout is in progress. */
  endedAt?: string
  exercises: WorkoutExercise[]
  notes: string
  /** Last performance per exercise id, set by set: the "Previous" column. */
  previous: Record<string, PlannedSet[]>
}

export type WorkoutUpdate = { exercises: WorkoutExercise[]; notes: string }

export type WorkoutSummary = {
  file: string
  name: string
  /** In progress (then `durationMin` is 0). */
  active: boolean
  date: string
  durationMin: number
  exercises: number
  sets: number
  volumeKg: number
  muscles: string[]
}

export type WeekDayCell = { date: string; trained: boolean }

export type TrainingToday = {
  profile: boolean
  planned: Routine | null
  active: Workout | null
  week: { days: WeekDayCell[]; volumeKg: number; done: number; planned: number }
  streak: number
}

type PersonalRecord = {
  exercise: string
  name: string
  kg: number
  reps: number
  e1rm: number
  previousE1rm?: number
}

export type FinishResult = {
  workout: Workout
  prs: PersonalRecord[]
  votes: Array<{ identity: string; kind: 'full' | 'small' }>
}

export type ProgressRange = '8w' | '6m' | 'all'

export type ProgressPr = {
  exercise: string
  name: string
  date: string
  kg: number
  reps: number
  e1rm: number
  delta?: number
}

export type TrainingProgress = {
  volume: Array<{ label: string; kg: number }>
  prs: ProgressPr[]
  body: Array<{ date: string; kg: number }>
}

/** Training's pages besides Today. */
export type TrainingTab = 'routines' | 'log' | 'progress' | 'library' | 'setup'
