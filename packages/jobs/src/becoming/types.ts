import { z } from 'zod'

import { WEEKDAYS } from '../calendar/types.js'
import { dayField } from '../helpers/dates.js'

// Becoming: who the user is trying to become, and the proof Zync collects for it.
//
//   <ws>/Becoming/writer.md            one identity: frontmatter below, body = the why + "## Proof"
//   ---
//   statement: I am a writer
//   action: Write 300 words
//   small: One sentence              # the 2-minute version, asked on heavy days
//   when: morning                    # morning | midday | evening | "07:30"
//   minutes: 40                      # full-version length; also what counts as a full vote from files
//   signals:                         # what Zync can see when it happens
//     - files: Writing/
//     - card: { label: essay }
//     - workout: { minMinutes: 20 }   # a finished workout in Training/Log
//   guards:                          # time the whole app keeps free
//     - { label: Mornings are for writing, from: "07:00", to: "09:00", days: [mon, tue, wed, thu, fri] }
//   stage: trying                    # experiment | trying | sticking | part
//   since: 2026-08-31                # first day
//   stageSince: 2026-09-14
//   ---
//
//   <ws>/Becoming/.votes.jsonl         one line per vote, last line of a (date, identity) wins
//   <ws>/.zync/activity.jsonl          what was edited and when, written by the scheduler's recorder

export const BECOMING_DIR = 'Becoming'
export const MIRROR_DIR = 'Becoming/Mirror'
export const VOTES_FILE = '.votes.jsonl'

export const STAGES = ['experiment', 'trying', 'sticking', 'part'] as const
export type Stage = (typeof STAGES)[number]

export const WINDOWS = ['morning', 'midday', 'evening'] as const
export type Window = (typeof WINDOWS)[number]

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
/** "HH:MM", plus "24:00" for the end of a guard. */
const clock = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, { message: 'must look like 19:00' })

export const WhenSchema = z.union([z.enum(WINDOWS), z.string().regex(HHMM, { message: 'must look like 07:30' })])
export type When = z.infer<typeof WhenSchema>

export const SignalSchema = z.union([
  z.object({ files: z.string().trim().min(1).max(200) }),
  z.object({ event: z.string().trim().min(1).max(60) }),
  z.object({
    card: z.object({ label: z.string().trim().min(1).max(30).optional(), board: z.string().trim().min(1).optional() }),
  }),
  z.object({ manual: z.literal(true) }),
  /** A finished workout in Training/Log: full from `minMinutes` (default 20), small below. */
  z.object({ workout: z.object({ minMinutes: z.number().int().min(1).max(600).optional() }) }),
])
export type Signal = z.infer<typeof SignalSchema>

export const GuardSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    from: clock,
    to: clock,
    days: z.array(z.enum(WEEKDAYS)).optional(),
  })
  .refine((g) => g.from < g.to, { message: 'a guard must end after it starts' })
export type Guard = z.infer<typeof GuardSchema>

const day = dayField('must look like 2026-09-28')

/** Frontmatter keys we manage, in the order they are written. Anything else is kept as-is. */
export const IDENTITY_FIELDS = {
  statement: z.string().trim().min(1).max(120),
  action: z.string().trim().min(1).max(120),
  small: z.string().trim().min(1).max(120),
  when: WhenSchema,
  minutes: z.number().int().min(2).max(480),
  signals: z.array(SignalSchema),
  guards: z.array(GuardSchema),
  stage: z.enum(STAGES),
  since: day,
  stageSince: day,
  /** A stage suggestion the user dismissed: not offered again before this day. */
  quietUntil: day,
}
type FieldName = keyof typeof IDENTITY_FIELDS
export const isIdentityField = (k: string): k is FieldName => Object.hasOwn(IDENTITY_FIELDS, k)

export type ProofLine = { date: string; text: string; source: string }

export type Identity = {
  /** File name inside Becoming/, e.g. "writer.md". */
  file: string
  statement: string
  action: string
  small?: string
  when?: When
  minutes: number
  signals: Signal[]
  guards: Guard[]
  stage: Stage
  since: string
  stageSince: string
  quietUntil?: string
  /** The body without the proof section: why the user wants this. */
  why: string
  /** The "## Proof" section, newest first. */
  proof: ProofLine[]
  extra: Record<string, unknown>
}

/** Fields a caller may set. `null` clears an optional field. */
export type IdentityPatch = {
  statement?: string
  action?: string
  small?: string | null
  when?: When | null
  minutes?: number
  signals?: Signal[]
  guards?: Guard[]
  stage?: Stage
  quietUntil?: string | null
  why?: string
}

export const IdentityInputSchema = z.object({
  statement: IDENTITY_FIELDS.statement,
  action: IDENTITY_FIELDS.action,
  small: IDENTITY_FIELDS.small.optional(),
  when: WhenSchema.optional(),
  minutes: IDENTITY_FIELDS.minutes.optional(),
  signals: z.array(SignalSchema).optional(),
  guards: z.array(GuardSchema).optional(),
  stage: z.enum(STAGES).optional(),
  why: z.string().max(4000).optional(),
})
export type IdentityInput = z.infer<typeof IdentityInputSchema>

export const IdentityPatchSchema = z.object({
  statement: IDENTITY_FIELDS.statement.optional(),
  action: IDENTITY_FIELDS.action.optional(),
  small: IDENTITY_FIELDS.small.nullable().optional(),
  when: WhenSchema.nullable().optional(),
  minutes: IDENTITY_FIELDS.minutes.optional(),
  signals: z.array(SignalSchema).optional(),
  guards: z.array(GuardSchema).optional(),
  stage: z.enum(STAGES).optional(),
  quietUntil: day.nullable().optional(),
  why: z.string().max(4000).optional(),
})

/** Full version, 2-minute version, or an undo ("clear") of the day's vote. */
export const VOTE_KINDS = ['full', 'small', 'clear'] as const
export type VoteKind = (typeof VOTE_KINDS)[number]
export const VOTE_SOURCES = ['auto', 'tap', 'palette', 'ntfy', 'ai'] as const
export type VoteSource = (typeof VOTE_SOURCES)[number]

export const VoteSchema = z.object({
  date: day,
  identity: z.string().min(1),
  kind: z.enum(VOTE_KINDS),
  source: z.enum(VOTE_SOURCES),
  note: z.string().max(200).optional(),
  at: z.string(),
})
export type Vote = z.infer<typeof VoteSchema>

/** A day's standing vote for one identity (a "clear" leaves none). */
export type DayVote = { kind: 'full' | 'small'; source: VoteSource; note?: string }

export const ACTIVITY_KINDS = ['edit', 'card-done', 'card-moved'] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export const ActivitySchema = z.object({
  /** Local wall-clock "YYYY-MM-DDTHH:MM". */
  t: z.string(),
  /** Workspace-relative file. */
  path: z.string(),
  kind: z.enum(ACTIVITY_KINDS),
  /** Cards: their labels when it moved. */
  labels: z.array(z.string()).optional(),
})
export type Activity = z.infer<typeof ActivitySchema>

/** Something on the calendar that takes the user's time: a zync event or an external one. */
export type Busy = { title: string; start: string; end: string; recurring?: boolean }

/** A finished workout, as evidence: its local day and times ("HH:MM"), length and volume. */
export type WorkoutDone = { date: string; start: string; end: string; name: string; minutes: number; volumeKg: number }

/** What Zync saw for an identity on a day. */
export type Evidence = { kind: 'full' | 'small'; note: string }
