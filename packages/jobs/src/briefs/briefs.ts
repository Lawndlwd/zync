import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { badRequest, notFound } from '../errors.js'
import { listMdFiles } from '../helpers/files.js'
import { safeResolve } from '../workspaces.js'
import { parseBrief, serializeBrief } from './brief-file.js'
import { splitTodos } from './todo-list.js'
import {
  type Brief,
  BriefDate,
  type BriefInput,
  BRIEFS_DIR,
  type BriefSummary,
  type Todo,
  TodoInputSchema,
} from './types.js'

const briefsDir = (wsPath: string) => safeResolve(wsPath, BRIEFS_DIR)
const fileOf = (date: string) => `${BriefDate.parse(date)}.md`

async function readSource(wsPath: string, date: string): Promise<string | null> {
  return readFile(path.join(await briefsDir(wsPath), fileOf(date)), 'utf8').catch(() => null)
}

/** Briefs between `from` and `to` (inclusive, "YYYY-MM-DD"), oldest first. */
export async function listBriefs(wsPath: string, from = '0000-00-00', to = '9999-99-99'): Promise<BriefSummary[]> {
  const dir = await briefsDir(wsPath)
  const dates = (await listMdFiles(dir))
    .map((f) => f.slice(0, -3))
    .filter((d) => BriefDate.safeParse(d).success && d >= from && d <= to)
    .toSorted()
  return Promise.all(
    dates.map(async (date) => {
      const brief = parseBrief(date, (await readSource(wsPath, date)) ?? '')
      return { date, todos: brief.todos.length, open: brief.todos.filter((t) => !t.done && !t.card).length }
    }),
  )
}

export async function readBrief(wsPath: string, date: string): Promise<Brief> {
  const src = await readSource(wsPath, date)
  if (src === null) throw notFound(`No brief for ${date}`)
  return parseBrief(date, src)
}

async function save(wsPath: string, brief: Brief): Promise<Brief> {
  const dir = await briefsDir(wsPath)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, fileOf(brief.date)), serializeBrief(brief))
  return brief
}

/**
 * Write (or rewrite) a day's brief. Running the job twice keeps what you already did: a to-do with
 * the same title as before keeps its tick and its card.
 */
export async function writeBrief(wsPath: string, date: string, input: BriefInput): Promise<Brief> {
  const src = await readSource(wsPath, date)
  const previous = src === null ? null : parseBrief(date, src)
  const before = new Map(previous?.todos.map((t) => [t.title, t]))
  const todos = input.todos.map((t) => {
    const todo = TodoInputSchema.parse(t)
    const was = before.get(todo.title)
    return { ...todo, done: was?.done ?? false, ...(was?.card ? { card: was.card } : {}) }
  })
  return save(wsPath, {
    date: BriefDate.parse(date),
    todos,
    sources: input.sources ?? [],
    // The checklist is made from `todos`: one the AI wrote in the markdown too would be a duplicate.
    body: splitTodos(input.body).rest,
    extra: previous?.extra ?? {},
  })
}

async function changeTodo(wsPath: string, date: string, index: number, patch: Partial<Todo>): Promise<Brief> {
  const brief = await readBrief(wsPath, date)
  const todo = brief.todos[index]
  if (!todo) throw badRequest(`The brief of ${date} has no to-do #${index + 1}`)
  return save(wsPath, { ...brief, todos: brief.todos.with(index, { ...todo, ...patch }) })
}

/** Record that to-do `index` of a day's brief became the card at `card` (workspace-relative). */
export const linkTodo = (wsPath: string, date: string, index: number, card: string) =>
  changeTodo(wsPath, date, index, { card })

/** Tick (or untick) to-do `index` of a day's brief. */
export const setTodoDone = (wsPath: string, date: string, index: number, done: boolean) =>
  changeTodo(wsPath, date, index, { done })
