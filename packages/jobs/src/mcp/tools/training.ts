import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import {
  DAYS,
  deleteRoutine,
  listRoutines,
  listWorkouts,
  LogWorkoutSchema,
  logWorkout,
  ownedEquipment,
  PROGRESS_RANGES,
  readProfile,
  RoutineExerciseSchema,
  RoutineInputSchema,
  ROUTINES_DIR,
  saveProfile,
  saveRoutine,
  searchExercises,
  TRAINING_DIR,
  TrainingProfileInputSchema,
  trainingProgress,
} from '../../training/index.js'
import { resolveWorkspace } from '../../workspaces.js'
import { workspaceArg } from '../args.js'
import { safe } from '../format.js'

const exercisesArg = z
  .array(RoutineExerciseSchema)
  .describe(
    'In order, compounds first. exercise = an id from search_exercises (never invented); name = its name; ' +
      'scheme = sets×rep range and rest, e.g. "3×8-12 · 90s" (the rep range drives progression); rest in seconds; ' +
      'sets = one target per set, e.g. [{reps: 10}, {reps: 10}, {reps: 10}], kg only when you know a sensible weight.',
  )

export function registerTrainingTools(server: McpServer): void {
  server.registerTool(
    'search_exercises',
    {
      description:
        "Find exercises in the catalog (1,300+ exercises with instructions and GIFs) and the user's custom ones. " +
        'Always use it to get exercise ids for routines and workouts: never invent an id. Search by words of the name ' +
        '("bench press", "goblet squat"); filter by muscle group or equipment; owned=true keeps what the profile owns.',
      inputSchema: {
        workspace: workspaceArg,
        query: z.string().optional().describe('Words of the exercise name.'),
        muscle: z
          .string()
          .optional()
          .describe(
            'Muscle group: Back, Cardio, Chest, Lower Arms, Lower Legs, Neck, Shoulders, Upper Arms, Upper Legs, Waist.',
          ),
        equipment: z.string().optional().describe('Equipment, e.g. Barbell, Dumbbell, Body Weight, Cable, Kettlebell.'),
        owned: z.boolean().optional().describe('Only exercises the equipment in the training profile allows.'),
        limit: z.number().int().min(1).max(50).optional().describe('Default 15.'),
      },
    },
    safe(async ({ workspace, query, muscle, equipment, owned, limit }) => {
      const ws = await resolveWorkspace(workspace)
      const profile = owned ? await readProfile(ws.path) : null
      const found = await searchExercises(ws.path, {
        ...(query ? { q: query } : {}),
        ...(muscle ? { muscle } : {}),
        ...(equipment ? { equipment } : {}),
        owned: profile ? ownedEquipment(profile.equipment) : null,
        limit: limit ?? 15,
      })
      return {
        total: found.total,
        items: found.items.map((e) => ({
          id: e.id,
          name: e.name,
          muscleGroup: e.muscleGroup,
          equipment: e.equipment,
          target: e.target,
        })),
      }
    }),
  )

  server.registerTool(
    'training_profile',
    {
      description:
        `The user's training profile (${TRAINING_DIR}/profile.md): goal, experience, equipment, injuries, days per week, ` +
        'session length, units, body facts. null when not set up yet.',
      inputSchema: { workspace: workspaceArg },
    },
    safe(async ({ workspace }) => readProfile((await resolveWorkspace(workspace)).path)),
  )

  server.registerTool(
    'save_training_profile',
    {
      description:
        'Set up or replace the training profile from what the user told you (all fields at once; read it first to keep ' +
        'what they did not change). Weights are always in kg; units is only how the app shows them.',
      inputSchema: { workspace: workspaceArg, ...TrainingProfileInputSchema.shape },
    },
    safe(async ({ workspace, ...input }) => saveProfile((await resolveWorkspace(workspace)).path, input)),
  )

  server.registerTool(
    'list_routines',
    {
      description: `The user's routines (${ROUTINES_DIR}/): name, weekdays, exercises with scheme and targets, notes.`,
      inputSchema: { workspace: workspaceArg },
    },
    safe(async ({ workspace }) => listRoutines((await resolveWorkspace(workspace)).path)),
  )

  server.registerTool(
    'save_routine',
    {
      description:
        `Create a routine (${ROUTINES_DIR}/<name>.md), or replace the one with the same name, following the training skill. ` +
        'Unknown exercise ids are rejected with the closest matches: search_exercises and retry.',
      inputSchema: {
        workspace: workspaceArg,
        ...RoutineInputSchema.shape,
        name: z.string().describe('Short and clear, e.g. "Push Day", "Full Body A". It is the file name.'),
        days: z
          .array(z.enum(DAYS))
          .optional()
          .describe('Weekdays it is planned on; across routines, no weekday twice.'),
        exercises: exercisesArg.optional(),
      },
    },
    safe(async ({ workspace, ...input }) => saveRoutine((await resolveWorkspace(workspace)).path, input)),
  )

  server.registerTool(
    'delete_routine',
    {
      description: 'Delete a routine. Past workouts done with it stay in the log. Only when the user asks.',
      inputSchema: {
        workspace: workspaceArg,
        file: z.string().describe('Routine file name from list_routines, e.g. "Push Day.md".'),
      },
    },
    safe(async ({ workspace, file }) => {
      await deleteRoutine((await resolveWorkspace(workspace)).path, file)
      return `Deleted routine ${file}.`
    }),
  )

  server.registerTool(
    'list_workouts',
    {
      description:
        'Workouts done (newest first): date, name, duration, exercises, sets, volume (kg), muscles; active = in progress.',
      inputSchema: {
        workspace: workspaceArg,
        month: z.string().optional().describe('"YYYY-MM"; default every month.'),
      },
    },
    safe(async ({ workspace, month }) => listWorkouts((await resolveWorkspace(workspace)).path, month)),
  )

  server.registerTool(
    'log_workout',
    {
      description:
        'Record a workout the user tells you they did ("did 3×5 squats at 100 kg this morning"): finished, every set ' +
        'done. Weights in kg (convert from lb). Returns the personal records and the Becoming votes it counted for.',
      inputSchema: {
        workspace: workspaceArg,
        ...LogWorkoutSchema.shape,
        date: z.string().optional().describe('"YYYY-MM-DD", default today.'),
        time: z.string().optional().describe('Start time "HH:MM", default 18:00.'),
        minutes: z.number().int().optional().describe('How long it took, default 45.'),
        routine: z.string().optional().describe('Routine file it followed, from list_routines.'),
      },
    },
    safe(async ({ workspace, ...input }) => logWorkout((await resolveWorkspace(workspace)).path, input)),
  )

  server.registerTool(
    'training_progress',
    {
      description:
        'Training progress: volume per week (8w) or month (6m, all), personal records (best estimated 1RM going up, ' +
        'with the gain), and body weight.',
      inputSchema: {
        workspace: workspaceArg,
        range: z.enum(PROGRESS_RANGES).optional().describe('Default 8w.'),
      },
    },
    safe(async ({ workspace, range }) => trainingProgress((await resolveWorkspace(workspace)).path, range ?? '8w')),
  )
}
