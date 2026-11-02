import { localStamp } from '../helpers/dates.js'
import { readProfile } from './profile.js'
import { dayOf, listRoutines, plannedOn } from './routines.js'
import { readWorkouts } from './workouts.js'

/** The first message of the chat that turns the training profile into routines. */
export const PLAN_PROMPT = [
  'Build my training plan with the training skill.',
  'Read my profile with training_profile and my current routines with list_routines, then design the routines',
  '(find every exercise id with search_exercises, never invent one) and save them with save_routine.',
  'Tell me the plan in a few lines, ask what I want to change, and offer to link it to a Becoming identity.',
].join(' ')

const label = (s: string) => s.replaceAll('_', ' ')

/**
 * The Training block of the system prompt: goal, week, today's routine, a workout in progress.
 * Empty until the user set up a profile.
 */
export async function buildTrainingPrompt(wsPath: string, now = localStamp()): Promise<string> {
  const profile = await readProfile(wsPath).catch(() => null)
  if (!profile) return ''
  const [routines, workouts] = await Promise.all([
    listRoutines(wsPath).catch(() => []),
    readWorkouts(wsPath).catch(() => []),
  ])
  const today = now.slice(0, 10)
  const planned = plannedOn(routines, today)
  const active = workouts.find((w) => w.endedAt === undefined)
  const facts = [
    label(profile.goal),
    ...(profile.experience ? [profile.experience] : []),
    `${profile.daysPerWeek} days/week`,
    ...(profile.sessionMinutes ? [`${profile.sessionMinutes} min sessions`] : []),
    `equipment: ${profile.equipment.map(label).join(', ')}`,
    ...(profile.injuries ? [`injuries: ${profile.injuries}`] : []),
    `shows weights in ${profile.units}`,
  ]
  return [
    '<training>',
    'The user trains with Zync (Training/ pages; training_profile, list_routines, list_workouts, training_progress, log_workout). Load the training skill before designing or changing a plan.',
    `- Profile: ${facts.join(' · ')}`,
    `- Routines: ${routines.length > 0 ? routines.map((r) => `${r.name} (${r.days.join(', ') || 'no day'})`).join('; ') : 'none yet'}`,
    `- Today (${dayOf(today)}): ${planned ? `${planned.name}, ${planned.exercises.length} exercises` : 'no routine planned'}`,
    ...(active
      ? [`- In progress: ${active.name}, started ${localStamp(new Date(active.startedAt)).slice(11, 16)}`]
      : []),
    'When the user says they trained ("did legs today"), record it with log_workout. Weights are stored in kg.',
    '</training>',
  ].join('\n')
}
