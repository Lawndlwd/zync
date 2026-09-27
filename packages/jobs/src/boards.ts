import { createHash } from 'node:crypto'
import { access, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'
import {
  defaultTimezone,
  deleteJob,
  type Job,
  jobPath,
  nextRuns,
  requestRun,
  serializeJob,
  validateJob,
  writeJob,
} from './job-file.js'
import type { RunRecord } from './runs.js'
import { safeResolve } from './workspaces.js'

// A board is an ordinary workspace folder marked by a hidden `.board.json` (its columns).
// Every markdown file directly inside it is a card: the file name is the title, the frontmatter
// holds the card fields (status, assignee, due, …) and the body is the description.
//
//   <ws>/Sprint 1/.board.json
//   <ws>/Sprint 1/Write the report.md
//
// A card assigned to "ai" with a run time gets a linked one-shot job (.opencode/jobs/card-….md);
// the scheduler runs it like any job and moves the card through doing → review (or back to todo).

export const BOARD_FILE = '.board.json'
export const AI_ASSIGNEE = 'ai'

/** Column ids the scheduler relies on. Names are free; missing columns are simply skipped. */
export const DEFAULT_COLUMNS = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'todo', name: 'To do' },
  { id: 'doing', name: 'In progress' },
  { id: 'review', name: 'Review' },
  { id: 'done', name: 'Done' },
]

const ID_RE = /^[a-z0-9][a-z0-9-]{0,29}$/
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
const DUE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/
const SCAN_DEPTH = 3
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build'])

// YAML turns unquoted dates into Date objects; normalise back to a string.
const dateString = (re: RegExp, message: string) =>
  z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10) : v),
    z.string().regex(re, { message }),
  )

const ColumnSchema = z.object({ id: z.string().regex(ID_RE), name: z.string().trim().min(1).max(40) })
export type Column = z.infer<typeof ColumnSchema>

const BoardFileSchema = z.object({
  columns: z
    .array(ColumnSchema)
    .min(1)
    .refine((cols) => new Set(cols.map((c) => c.id)).size === cols.length, { message: 'duplicate column id' }),
})

export interface Board {
  /** Workspace-relative folder path, e.g. "Sprint 1" or "projects/Sprint 1". */
  path: string
  name: string
  columns: Column[]
}

const AiStateSchema = z.object({
  state: z.enum(['scheduled', 'running', 'done', 'failed']),
  sessionId: z.string().optional(),
  finishedAt: z.string().optional(),
  summary: z.string().optional(),
})
export type CardAi = z.infer<typeof AiStateSchema>

/** Frontmatter keys we manage, in the order they are written. Anything else is kept as-is. */
const FIELDS = {
  title: z.string().trim().min(1).max(200),
  status: z.string().regex(ID_RE),
  assignee: z.string().regex(ID_RE),
  due: dateString(DUE_RE, 'due must look like 2026-09-28 or 2026-09-28T15:14'),
  /** Minutes the card takes on the calendar (from `due`, or `runAt` for the AI). Unset = 1 hour. */
  duration: z.number().int().min(5).max(1440),
  labels: z.array(z.string().trim().min(1).max(30)),
  runAt: dateString(DATE_TIME_RE, 'runAt must be a local date-time like 2026-09-28T15:14'),
  context: z.array(z.string()),
  order: z.number(),
  ai: AiStateSchema,
}
type FieldName = keyof typeof FIELDS

export interface Card {
  /** File name inside the board folder, e.g. "Write the report.md". */
  file: string
  title: string
  status?: string
  assignee?: string
  due?: string
  duration?: number
  labels: string[]
  runAt?: string
  context: string[]
  order?: number
  ai?: CardAi
  description: string
  /** Frontmatter keys we don't manage (or couldn't parse), preserved on write. */
  extra: Record<string, unknown>
}

/** Fields a caller may set. `null` clears an optional field. */
export interface CardPatch {
  title?: string
  status?: string
  order?: number
  assignee?: string | null
  due?: string | null
  duration?: number | null
  labels?: string[]
  runAt?: string | null
  context?: string[]
  description?: string
}

const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 })
const badRequest = (msg: string) => Object.assign(new Error(msg), { status: 400 })

const exists = (p: string) =>
  access(p).then(
    () => true,
    () => false,
  )

// ── names & paths ──────────────────────────────────────────────────────────

/** A title as a portable file/folder name: no path separators or reserved characters. */
export function safeName(title: string): string {
  const name = title
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 100)
    .trim()
  return name || 'Untitled'
}

function cleanBoardPath(boardPath: string): string {
  const rel = boardPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!rel || rel.split('/').some((seg) => !seg || seg === '.' || seg === '..' || seg.startsWith('.'))) {
    throw notFound(`Unknown board "${boardPath}"`)
  }
  return rel
}

async function boardDir(wsPath: string, boardPath: string): Promise<string> {
  return safeResolve(wsPath, cleanBoardPath(boardPath))
}

function checkCardFile(file: string): string {
  if (!file.endsWith('.md') || file.includes('/') || file.includes('\\') || file.startsWith('.')) {
    throw notFound(`Unknown card "${file}"`)
  }
  return file
}

/** Workspace-relative path of a card file; this is what a linked job points at. */
export const cardRef = (boardPath: string, file: string) => `${cleanBoardPath(boardPath)}/${file}`

/** Stable, valid job name for a card path (job names are kebab-case, ≤ 64 chars). */
export function cardJobName(ref: string): string {
  const base = path.posix
    .basename(ref, '.md')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  const hash = createHash('sha1').update(ref).digest('hex').slice(0, 8)
  return `card-${base ? `${base}-` : ''}${hash}`
}

// ── cards (de)serialisation ────────────────────────────────────────────────

/** Lenient: any markdown file is a card. Invalid fields are kept in `extra`, never dropped. */
export function parseCard(file: string, source: string): Card {
  let data: Record<string, unknown> = {}
  let content = source
  try {
    const parsed = matter(source)
    data = { ...parsed.data }
    content = parsed.content
  } catch {
    // Broken YAML: show the whole file as the description rather than hiding the card.
  }
  const card: Card = {
    file,
    title: path.basename(file, '.md'),
    labels: [],
    context: [],
    description: content.trim(),
    extra: {},
  }
  // Older cards used `column`.
  if (data.status === undefined && data.column !== undefined) {
    data.status = data.column
    delete data.column
  }
  const out = card as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(data)) {
    const schema = FIELDS[k as FieldName]
    const r = schema?.safeParse(v)
    if (r?.success) out[k] = r.data
    else card.extra[k] = v
  }
  return card
}

export function serializeCard(card: Card): string {
  const meta: Record<string, unknown> = {}
  for (const k of Object.keys(FIELDS) as FieldName[]) {
    const v = card[k]
    if (v === undefined || (Array.isArray(v) && v.length === 0)) continue
    meta[k] = v
  }
  for (const [k, v] of Object.entries(card.extra)) if (!(k in meta) && v !== undefined) meta[k] = v
  return matter.stringify(card.description ? `\n${card.description}\n` : '', meta)
}

// ── boards ─────────────────────────────────────────────────────────────────

async function readBoardFile(dir: string): Promise<Column[]> {
  const src = await readFile(path.join(dir, BOARD_FILE), 'utf8')
  return BoardFileSchema.parse(JSON.parse(src)).columns
}

async function writeBoardFile(dir: string, columns: Column[]): Promise<void> {
  await writeFile(path.join(dir, BOARD_FILE), `${JSON.stringify(BoardFileSchema.parse({ columns }), null, 2)}\n`)
}

async function readBoardMeta(wsPath: string, boardPath: string): Promise<Board> {
  const rel = cleanBoardPath(boardPath)
  const dir = await boardDir(wsPath, rel)
  const columns = await readBoardFile(dir).catch((err) => {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') throw notFound(`"${rel}" is not a board`)
    throw err
  })
  return { path: rel, name: path.posix.basename(rel), columns }
}

/** Every folder (up to a few levels deep) that has a `.board.json`. */
export async function listBoards(wsPath: string): Promise<Board[]> {
  const out: Board[] = []
  const walk = async (rel: string, depth: number) => {
    const dir = rel ? path.join(wsPath, rel) : wsPath
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    if (rel && entries.some((e) => e.isFile() && e.name === BOARD_FILE)) {
      const columns = await readBoardFile(dir).catch(() => null)
      if (columns) out.push({ path: rel, name: path.posix.basename(rel), columns })
    }
    if (depth >= SCAN_DEPTH) return
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) {
        await walk(rel ? `${rel}/${e.name}` : e.name, depth + 1)
      }
    }
  }
  await walk('', 0)
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

/** Create a board folder, or turn an existing folder into a board. */
export async function createBoard(
  wsPath: string,
  input: { name: string; parent?: string; columns?: Column[] },
): Promise<Board> {
  const name = safeName(input.name)
  const rel = input.parent ? `${cleanBoardPath(input.parent)}/${name}` : name
  const dir = await boardDir(wsPath, rel)
  if (await exists(path.join(dir, BOARD_FILE))) throw badRequest(`"${rel}" is already a board`)
  const parsed = BoardFileSchema.safeParse({ columns: input.columns ?? DEFAULT_COLUMNS })
  if (!parsed.success) throw badRequest(`Invalid columns: ${parsed.error.issues[0]?.message}`)
  const { columns } = parsed.data
  await mkdir(dir, { recursive: true })
  await writeBoardFile(dir, columns)
  return { path: rel, name, columns }
}

export async function readBoard(wsPath: string, boardPath: string): Promise<{ board: Board; cards: Card[] }> {
  const board = await readBoardMeta(wsPath, boardPath)
  return { board, cards: await listCards(wsPath, board.path) }
}

/** Rename (moves the folder) and/or change columns. */
export async function updateBoard(
  wsPath: string,
  boardPath: string,
  patch: { name?: string; columns?: Column[] },
): Promise<Board> {
  let board = await readBoardMeta(wsPath, boardPath)
  if (patch.columns) {
    const kept = new Set(patch.columns.map((c) => c.id))
    const first = board.columns[0].id
    const orphans = (await listCards(wsPath, board.path)).filter((c) => !kept.has(c.status ?? first))
    if (orphans.length) throw badRequest(`Move the ${orphans.length} card(s) out of the removed column(s) first`)
    await writeBoardFile(await boardDir(wsPath, board.path), patch.columns)
    board = { ...board, columns: patch.columns }
  }
  if (patch.name !== undefined && safeName(patch.name) !== board.name) {
    const parent = path.posix.dirname(board.path)
    const rel = parent === '.' ? safeName(patch.name) : `${parent}/${safeName(patch.name)}`
    const to = await boardDir(wsPath, rel)
    if (await exists(to)) throw badRequest(`"${rel}" already exists`)
    const cards = await listCards(wsPath, board.path)
    for (const c of cards) await deleteJob(wsPath, cardJobName(cardRef(board.path, c.file))).catch(() => {})
    await rename(await boardDir(wsPath, board.path), to)
    board = { ...board, path: rel, name: path.posix.basename(rel) }
    // Job names derive from the card path, so re-link them under the new folder.
    for (const c of cards) {
      const synced = await syncCardJob(wsPath, board, c)
      if (synced !== c) await writeCard(wsPath, board.path, synced)
    }
  }
  return board
}

/** Stop treating the folder as a board. The card files stay where they are. */
export async function deleteBoard(wsPath: string, boardPath: string): Promise<void> {
  const board = await readBoardMeta(wsPath, boardPath)
  for (const card of await listCards(wsPath, board.path)) {
    await deleteJob(wsPath, cardJobName(cardRef(board.path, card.file))).catch(() => {})
  }
  await rm(path.join(await boardDir(wsPath, board.path), BOARD_FILE), { force: true })
}

// ── cards ──────────────────────────────────────────────────────────────────

/** Ordered cards first (by `order`), then the rest by title. */
export async function listCards(wsPath: string, boardPath: string): Promise<Card[]> {
  const dir = await boardDir(wsPath, boardPath)
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const cards: Card[] = []
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md') || e.name.startsWith('.')) continue
    const src = await readFile(path.join(dir, e.name), 'utf8').catch(() => null)
    if (src !== null) cards.push(parseCard(e.name, src))
  }
  const ord = (c: Card) => c.order ?? Number.POSITIVE_INFINITY
  return cards.sort((a, b) => ord(a) - ord(b) || a.title.localeCompare(b.title))
}

export async function readCard(wsPath: string, boardPath: string, file: string): Promise<Card> {
  const dir = await boardDir(wsPath, boardPath)
  const src = await readFile(path.join(dir, checkCardFile(file)), 'utf8').catch(() => {
    throw notFound(`Unknown card "${file}" on board "${boardPath}"`)
  })
  return parseCard(file, src)
}

async function writeCard(wsPath: string, boardPath: string, card: Card): Promise<void> {
  const dir = await boardDir(wsPath, boardPath)
  await writeFile(path.join(dir, checkCardFile(card.file)), serializeCard(card))
}

/** "Title.md", or "Title 2.md" … when taken (ignoring `current`, the card's own file). */
async function freeFileName(dir: string, title: string, current?: string): Promise<string> {
  const base = safeName(title)
  for (let i = 1; ; i++) {
    const file = i === 1 ? `${base}.md` : `${base} ${i}.md`
    if (file === current || !(await exists(path.join(dir, file)))) return file
  }
}

function applyPatch(card: Card, patch: CardPatch): Card {
  const next: Record<string, unknown> = { ...card }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (k === 'description') {
      next.description = String(v).trim()
      continue
    }
    const schema = FIELDS[k as FieldName]
    if (!schema) continue
    if (v === null) {
      if (k === 'labels' || k === 'context') next[k] = []
      else delete next[k]
    } else {
      next[k] = schema.parse(v)
    }
    // A field we now manage must not also linger in `extra`.
    const extra = next.extra as Record<string, unknown>
    if (k in extra) next.extra = Object.fromEntries(Object.entries(extra).filter(([e]) => e !== k))
  }
  return next as unknown as Card
}

function assertColumn(board: Board, status: string | undefined): void {
  if (status && !board.columns.some((c) => c.id === status)) {
    throw badRequest(`Board "${board.name}" has no column "${status}"`)
  }
}

export async function createCard(
  wsPath: string,
  boardPath: string,
  input: CardPatch & { title: string },
): Promise<Card> {
  const { board, cards } = await readBoard(wsPath, boardPath)
  const dir = await boardDir(wsPath, board.path)
  const first = board.columns[0].id
  const status = input.status ?? first
  assertColumn(board, status)
  const ordered = cards.filter((c) => (c.status ?? first) === status && c.order !== undefined)
  const order = input.order ?? (ordered.length ? Math.max(...ordered.map((c) => c.order as number)) + 1 : 0)
  const title = FIELDS.title.parse(input.title)
  const blank: Card = {
    file: await freeFileName(dir, title),
    title,
    labels: [],
    context: [],
    description: '',
    extra: {},
  }
  let card = applyPatch(blank, { ...input, title, status, order })
  card = await syncCardJob(wsPath, board, card)
  await writeCard(wsPath, board.path, card)
  return card
}

export async function updateCard(wsPath: string, boardPath: string, file: string, patch: CardPatch): Promise<Card> {
  const board = await readBoardMeta(wsPath, boardPath)
  const current = await readCard(wsPath, board.path, file)
  let card = applyPatch(current, patch)
  assertColumn(board, card.status)
  // The file name follows the title.
  if (card.title !== current.title) {
    const dir = await boardDir(wsPath, board.path)
    const nextFile = await freeFileName(dir, card.title, current.file)
    if (nextFile !== current.file) {
      await deleteJob(wsPath, cardJobName(cardRef(board.path, current.file))).catch(() => {})
      await rename(path.join(dir, current.file), path.join(dir, nextFile))
      card = { ...card, file: nextFile }
    }
  }
  card = await syncCardJob(wsPath, board, card)
  await writeCard(wsPath, board.path, card)
  return card
}

export async function deleteCard(wsPath: string, boardPath: string, file: string): Promise<void> {
  const board = await readBoardMeta(wsPath, boardPath)
  await readCard(wsPath, board.path, file)
  await deleteJob(wsPath, cardJobName(cardRef(board.path, file))).catch(() => {})
  await rm(path.join(await boardDir(wsPath, board.path), file))
}

// ── card ↔ job link ────────────────────────────────────────────────────────

export function cardJobInstructions(board: Board, card: Card): string {
  return [
    `You are working on the kanban card "${card.title}" (board "${board.name}", file ${cardRef(board.path, card.file)}).`,
    'Do not edit the card file: the board is updated automatically when you finish.',
    '',
    card.description || card.title,
  ].join('\n')
}

/**
 * Make the card's linked job match the card: an "ai" card with a run time has a one-shot job,
 * anything else has none. Returns the card with `ai` updated (caller writes it).
 */
export async function syncCardJob(wsPath: string, board: Board, card: Card, opts: { at?: string } = {}): Promise<Card> {
  const at = opts.at ?? card.runAt
  const ref = cardRef(board.path, card.file)
  const name = cardJobName(ref)

  if (card.assignee !== AI_ASSIGNEE || !at) {
    await deleteJob(wsPath, name).catch(() => {})
    return card.ai?.state === 'scheduled' ? { ...card, ai: undefined } : card
  }

  const job: Job = validateJob({
    name,
    at,
    card: ref,
    context: card.context,
    notify: 'always',
    enabled: true,
    instructions: cardJobInstructions(board, card),
  })
  const existing = await readFile(jobPath(wsPath, name), 'utf8').catch(() => null)
  // Rewriting an unchanged job would bump its mtime and make the scheduler re-register it for nothing.
  if (existing === serializeJob(job)) return card
  await writeJob(wsPath, job, { overwrite: true })
  if (card.ai?.state !== 'running' && nextRuns(job, 1).length) return { ...card, ai: { state: 'scheduled' } }
  return card
}

/** A moment as local wall-clock YYYY-MM-DDTHH:MM in `timeZone` (default: the scheduler's). */
export function localStamp(date = new Date(), timeZone = defaultTimezone()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/**
 * Assign to @ai (if not already) and run immediately. Clears any pending run time so the card
 * doesn't run a second time later.
 */
export async function runCardNow(wsPath: string, boardPath: string, file: string): Promise<Card> {
  const board = await readBoardMeta(wsPath, boardPath)
  let card = applyPatch(await readCard(wsPath, board.path, file), { assignee: AI_ASSIGNEE, runAt: null })
  if (card.ai?.state === 'running') throw badRequest('This card is already running')
  card = await syncCardJob(wsPath, board, card, { at: localStamp() })
  await requestRun(wsPath, cardJobName(cardRef(board.path, card.file)))
  card = { ...card, ai: { state: 'scheduled' } }
  await writeCard(wsPath, board.path, card)
  return card
}

// ── scheduler hook ─────────────────────────────────────────────────────────

export type CardRunEvent =
  | { type: 'started'; sessionId: string }
  | { type: 'finished'; run: Pick<RunRecord, 'status' | 'summary' | 'sessionId' | 'ts'> }

/** Pure: where a card goes when its AI run starts or ends. */
export function cardAfterRun(card: Card, columns: Column[], event: CardRunEvent): Card {
  const move = (id: string) => (columns.some((c) => c.id === id) ? id : card.status)
  if (event.type === 'started') {
    return { ...card, status: move('doing'), ai: { state: 'running', sessionId: event.sessionId } }
  }
  const { run } = event
  if (run.status === 'skipped') return card
  const ok = run.status === 'ok'
  return {
    ...card,
    status: move(ok ? 'review' : 'todo'),
    ai: {
      state: ok ? 'done' : 'failed',
      sessionId: run.sessionId ?? card.ai?.sessionId,
      finishedAt: run.ts,
      summary: run.summary.slice(0, 2000),
    },
  }
}

/**
 * A card file was written directly (file editor, another tool): make its linked job match the file,
 * exactly as an edit through the card API would. No-op for files outside a board.
 */
export async function syncCardFile(wsPath: string, rel: string): Promise<void> {
  const boardPath = path.posix.dirname(rel)
  if (boardPath === '.' || !rel.endsWith('.md') || path.posix.basename(rel).startsWith('.')) return
  const board = await readBoardMeta(wsPath, boardPath).catch(() => null)
  if (!board) return
  const card = await readCard(wsPath, board.path, path.posix.basename(rel))
  const synced = await syncCardJob(wsPath, board, card)
  if (synced !== card) await writeCard(wsPath, board.path, synced)
}

/** Does the card a job points at still exist (on a board)? */
export async function cardExists(wsPath: string, ref: string): Promise<boolean> {
  try {
    const board = await readBoardMeta(wsPath, path.posix.dirname(ref))
    const s = await stat(path.join(await boardDir(wsPath, board.path), checkCardFile(path.posix.basename(ref))))
    return s.isFile()
  } catch {
    return false
  }
}

/** Apply a run event to the card a job points at ("<board path>/<file>.md"). No-op if it's gone. */
export async function applyCardRun(wsPath: string, ref: string, event: CardRunEvent): Promise<Card | null> {
  try {
    const board = await readBoardMeta(wsPath, path.posix.dirname(ref))
    const card = await readCard(wsPath, board.path, path.posix.basename(ref))
    const next = cardAfterRun(card, board.columns, event)
    await writeCard(wsPath, board.path, next)
    return next
  } catch {
    return null
  }
}
