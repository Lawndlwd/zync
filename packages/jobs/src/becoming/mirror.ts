import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { badRequest, notFound } from '../errors.js'
import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter.js'
import { listMdFiles } from '../helpers/files.js'
import { safeResolve } from '../workspaces.js'
import { readIdentity, updateIdentity } from './store.js'
import { GuardSchema, type Identity, MIRROR_DIR, WhenSchema } from './types.js'
import { type BecomingWeek, BecomingWeekSchema, weekMonday } from './week.js'

// The Mirror: one page a week, Becoming/Mirror/2026-W39.md. The numbers (`stats`) are computed by
// Zync; the facts, the three questions and the one change are written by the AI; the user answers
// the questions and applies the change from the page.

export const FactSchema = z.object({
  /** The identity file it is about; none for unclaimed time. */
  identity: z.string().optional(),
  /** One plain sentence; **bold** allowed. */
  text: z.string().trim().min(1).max(400),
})

export const QuestionSchema = z.object({
  identity: z.string().optional(),
  q: z.string().trim().min(1).max(300),
  /** Answers offered as buttons; none means a free answer. */
  options: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
  answer: z.string().max(1000).optional(),
})

/** What applying the change does to an identity: add guards, move it, shrink it. */
export const ChangePatchSchema = z.object({
  guards: z.array(GuardSchema).optional(),
  when: WhenSchema.optional(),
  small: z.string().trim().min(1).max(120).optional(),
  minutes: z.number().int().min(2).max(480).optional(),
})

export const ChangeSchema = z.object({
  /** "Add guard: Mornings 7–9 are for writing" */
  label: z.string().trim().min(1).max(120),
  /** What it does, one line. */
  detail: z.string().max(300).optional(),
  identity: z.string().min(1),
  patch: ChangePatchSchema,
  /** A second, smaller option shown as a link ("or move Thursday 18:30 sync"). */
  alternative: z.string().max(120).optional(),
  applied: z.boolean().optional(),
})

export const MirrorInputSchema = z.object({
  facts: z.array(FactSchema).max(8),
  questions: z.array(QuestionSchema).max(3),
  change: ChangeSchema.optional(),
  /** Anything else worth writing, in markdown (optional). */
  body: z.string().max(8000).optional(),
})
export type MirrorInput = z.input<typeof MirrorInputSchema>

export type Mirror = {
  week: string
  generated: string
  stats: BecomingWeek
  facts: Array<z.infer<typeof FactSchema>>
  questions: Array<z.infer<typeof QuestionSchema>>
  change?: z.infer<typeof ChangeSchema>
  body: string
}

const WeekName = z.string().regex(/^\d{4}-W\d{2}$/, { message: 'week must look like 2026-W39' })

const mirrorDir = (wsPath: string) => safeResolve(wsPath, MIRROR_DIR)
const fileOf = (week: string) => `${WeekName.parse(week)}.md`

/** The items of a list that still parse (a hand-edited page keeps what it can). */
const list = <T>(schema: z.ZodType<T>, v: unknown): T[] =>
  Array.isArray(v)
    ? v.flatMap((x) => {
        const r = schema.safeParse(x)
        return r.success ? [r.data] : []
      })
    : []

/** Lenient on read: a hand-edited page keeps what still parses. */
function parseMirror(week: string, source: string): Mirror {
  const { data, content } = parseFrontmatter(source)
  const stats = BecomingWeekSchema.safeParse(data.stats)
  if (!stats.success) throw badRequest(`The Mirror of ${week} has no readable stats`)
  const change = ChangeSchema.safeParse(data.change)
  return {
    week,
    generated: typeof data.generated === 'string' ? data.generated : '',
    stats: stats.data,
    facts: list(FactSchema, data.facts),
    questions: list(QuestionSchema, data.questions),
    ...(change.success ? { change: change.data } : {}),
    body: content.trim(),
  }
}

function serializeMirror(m: Mirror): string {
  const meta: Record<string, unknown> = { week: m.week, generated: m.generated, facts: m.facts, questions: m.questions }
  if (m.change) meta.change = m.change
  meta.stats = m.stats
  return stringifyFrontmatter(meta, m.body)
}

/** Weeks that have a Mirror, newest first. */
export async function listMirrors(wsPath: string): Promise<string[]> {
  const files = await listMdFiles(await mirrorDir(wsPath))
  return files
    .map((f) => f.slice(0, -3))
    .filter((w) => weekMonday(w) !== null)
    .toSorted()
    .toReversed()
}

export async function readMirror(wsPath: string, week: string): Promise<Mirror> {
  const src = await readFile(path.join(await mirrorDir(wsPath), fileOf(week)), 'utf8').catch(() => {
    throw notFound(`No Mirror for ${week}`)
  })
  return parseMirror(week, src)
}

async function save(wsPath: string, m: Mirror): Promise<Mirror> {
  const dir = await mirrorDir(wsPath)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, fileOf(m.week)), serializeMirror(m))
  return m
}

/**
 * Write (or rewrite) a week's Mirror from the AI's words and Zync's numbers. Answers the user already
 * gave to a question with the same text are kept.
 */
export async function writeMirror(wsPath: string, stats: BecomingWeek, raw: MirrorInput): Promise<Mirror> {
  const input = MirrorInputSchema.parse(raw)
  const previous = await readMirror(wsPath, stats.week).catch(() => null)
  const answered = new Map(previous?.questions.flatMap((q) => (q.answer ? [[q.q, q.answer]] : [])))
  return save(wsPath, {
    week: stats.week,
    generated: new Date().toISOString(),
    stats,
    facts: input.facts,
    questions: input.questions.map((q) => {
      const answer = q.answer ?? answered.get(q.q)
      return answer ? { ...q, answer } : q
    }),
    ...(input.change ? { change: input.change } : {}),
    body: input.body?.trim() ?? '',
  })
}

export async function answerQuestion(wsPath: string, week: string, index: number, answer: string): Promise<Mirror> {
  const m = await readMirror(wsPath, week)
  const q = m.questions[index]
  if (!q) throw badRequest(`The Mirror of ${week} has no question #${index + 1}`)
  const text = answer.trim()
  const next = text ? { ...q, answer: text } : { identity: q.identity, q: q.q, options: q.options }
  return save(wsPath, { ...m, questions: m.questions.with(index, next) })
}

/** Apply the week's one change to its identity (guards are added to the ones it has). */
export async function applyChange(wsPath: string, week: string): Promise<{ mirror: Mirror; identity: Identity }> {
  const m = await readMirror(wsPath, week)
  if (!m.change) throw badRequest(`The Mirror of ${week} suggests no change`)
  if (m.change.applied) throw badRequest('This change is already applied')
  const current = await readIdentity(wsPath, m.change.identity)
  const { guards, ...rest } = m.change.patch
  const identity = await updateIdentity(wsPath, current.file, {
    ...rest,
    ...(guards ? { guards: [...current.guards, ...guards] } : {}),
  })
  const mirror = await save(wsPath, { ...m, change: { ...m.change, applied: true } })
  return { mirror, identity }
}
