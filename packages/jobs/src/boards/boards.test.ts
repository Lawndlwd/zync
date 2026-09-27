import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { safeName } from '../helpers/names.js'
import { jobPath, readJob, TRIGGER_DIR } from '../job-file.js'
import { createPerson, deletePerson, listPeople, updatePerson } from '../people/index.js'
import {
  applyCardRun,
  type Card,
  cardAfterRun,
  cardExists,
  cardJobName,
  cardRef,
  createBoard,
  createCard,
  DEFAULT_COLUMNS,
  deleteBoard,
  deleteCard,
  listBoards,
  parseCard,
  readBoard,
  readCard,
  runCardNow,
  serializeCard,
  updateBoard,
  updateCard,
} from './index.js'

let ws: string

beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'boards-'))
})

const card = (over: Partial<Card> = {}): Card => ({
  file: 'Write report.md',
  title: 'Write report',
  status: 'todo',
  labels: [],
  context: [],
  description: '',
  extra: {},
  ...over,
})

const jobFor = (board: string, file: string) => jobPath(ws, cardJobName(cardRef(board, file)))

describe('card files', () => {
  it('round-trips through markdown', () => {
    const c = card({
      assignee: 'ai',
      due: '2026-10-01',
      runAt: '2026-09-30T09:00',
      labels: ['q3'],
      description: 'Do it.',
    })
    expect(parseCard(c.file, serializeCard(c))).toEqual(c)
  })

  it('treats any markdown file as a card and keeps unknown or invalid fields', () => {
    const plain = parseCard('Just a note.md', '# Hello\n\nsome text')
    expect(plain).toMatchObject({ title: 'Just a note', description: '# Hello\n\nsome text' })
    expect(plain.status).toBeUndefined()

    const src = '---\ntitle: T\nstatus: Not A Column!\npriority: high\ndue: 2026-10-01\n---\nbody\n'
    const c = parseCard('T.md', src)
    expect(c).toMatchObject({ title: 'T', due: '2026-10-01', extra: { status: 'Not A Column!', priority: 'high' } })
    expect(serializeCard(c)).toContain('priority: high')
  })

  it('reads the old `column` field as status', () => {
    expect(parseCard('x.md', '---\ncolumn: doing\n---\n').status).toBe('doing')
  })

  it('makes titles safe file names', () => {
    expect(safeName('a/b: c?')).toBe('a-b- c-')
    expect(safeName('../..')).toBe('-')
    expect(safeName('...')).toBe('Untitled')
    expect(safeName('  ')).toBe('Untitled')
  })
})

describe('boards', () => {
  it('a board is a folder with .board.json; cards are .md files named after the title', async () => {
    const b = await createBoard(ws, { name: 'Sprint 1' })
    expect(b).toEqual({ path: 'Sprint 1', name: 'Sprint 1', columns: DEFAULT_COLUMNS })
    const c = await createCard(ws, b.path, { title: 'Write the report', status: 'todo', assignee: 'me' })
    expect(c.file).toBe('Write the report.md')
    const src = await readFile(path.join(ws, 'Sprint 1', 'Write the report.md'), 'utf8')
    expect(src).toMatch(/^---\ntitle: Write the report\nstatus: todo\nassignee: me\norder: 0\n---/)
    const dup = await createCard(ws, b.path, { title: 'Write the report' })
    expect(dup.file).toBe('Write the report 2.md')
  })

  it('finds boards in nested folders and adopts existing folders', async () => {
    await mkdir(path.join(ws, 'projects', 'Alpha'), { recursive: true })
    await writeFile(path.join(ws, 'projects', 'Alpha', 'Existing note.md'), 'hello')
    await createBoard(ws, { name: 'Alpha', parent: 'projects' })
    await createBoard(ws, { name: 'Top' })
    expect((await listBoards(ws)).map((b) => b.path)).toEqual(['projects/Alpha', 'Top'])
    const { cards } = await readBoard(ws, 'projects/Alpha')
    expect(cards.map((c) => c.title)).toEqual(['Existing note'])
    await expect(createBoard(ws, { name: 'Top' })).rejects.toThrow(/already a board/)
  })

  it('rejects paths outside the workspace', async () => {
    await expect(readBoard(ws, '../x')).rejects.toThrow(/Unknown board/)
    await expect(readBoard(ws, '.opencode')).rejects.toThrow(/Unknown board/)
    await createBoard(ws, { name: 'B' })
    await expect(readCard(ws, 'B', '../secret.md')).rejects.toThrow(/Unknown card/)
  })

  it('renaming a card renames its file', async () => {
    const b = await createBoard(ws, { name: 'B' })
    const c = await createCard(ws, b.path, { title: 'Old', description: 'keep me' })
    const r = await updateCard(ws, b.path, c.file, { title: 'New name' })
    expect(r.file).toBe('New name.md')
    expect(await readdir(path.join(ws, 'B'))).toEqual(['.board.json', 'New name.md'])
    expect((await readCard(ws, b.path, 'New name.md')).description).toBe('keep me')
  })

  it('rejects unknown columns and removing a column that still has cards', async () => {
    const b = await createBoard(ws, { name: 'B' })
    await expect(createCard(ws, b.path, { title: 'x', status: 'nope' })).rejects.toThrow(/no column/)
    await createCard(ws, b.path, { title: 'x', status: 'done' })
    await expect(updateBoard(ws, b.path, { columns: DEFAULT_COLUMNS.slice(0, 4) })).rejects.toThrow(/Move the 1 card/)
  })

  it('deleting a board keeps the files', async () => {
    const b = await createBoard(ws, { name: 'B' })
    await createCard(ws, b.path, { title: 'x' })
    await deleteBoard(ws, b.path)
    expect(await readdir(path.join(ws, 'B'))).toEqual(['x.md'])
    expect(await listBoards(ws)).toEqual([])
  })
})

describe('card ↔ job link', () => {
  it('creates, updates and removes the linked job as the card changes', async () => {
    const b = await createBoard(ws, { name: 'B' })
    let c = await createCard(ws, b.path, { title: 'Summarise', description: 'Summarise notes/.' })

    c = await updateCard(ws, b.path, c.file, { assignee: 'ai', runAt: '2099-01-01T09:00', context: ['notes/'] })
    expect(c.ai?.state).toBe('scheduled')
    const job = await readJob(ws, cardJobName(cardRef(b.path, c.file)))
    expect(job).toMatchObject({ at: '2099-01-01T09:00', card: 'B/Summarise.md', context: ['notes/'] })
    expect(job.instructions).toContain('Summarise notes/.')

    c = await updateCard(ws, b.path, c.file, { runAt: '2099-02-01T09:00' })
    expect((await readJob(ws, cardJobName(cardRef(b.path, c.file)))).at).toBe('2099-02-01T09:00')

    c = await updateCard(ws, b.path, c.file, { assignee: 'me' })
    expect(c.ai).toBeUndefined()
    await expect(readFile(jobFor(b.path, c.file))).rejects.toThrow('ENOENT')
  })

  it('moves the job when the card or board is renamed, and drops it on delete', async () => {
    const b = await createBoard(ws, { name: 'B' })
    const c = await createCard(ws, b.path, { title: 't', assignee: 'ai', runAt: '2099-01-01T09:00' })
    const r = await updateCard(ws, b.path, c.file, { title: 'renamed' })
    await expect(readFile(jobFor('B', 't.md'))).rejects.toThrow('ENOENT')
    expect((await readJob(ws, cardJobName('B/renamed.md'))).card).toBe('B/renamed.md')

    const b2 = await updateBoard(ws, b.path, { name: 'C' })
    expect(b2.path).toBe('C')
    await expect(readFile(jobFor('B', 'renamed.md'))).rejects.toThrow('ENOENT')
    expect((await readJob(ws, cardJobName('C/renamed.md'))).card).toBe('C/renamed.md')

    await deleteCard(ws, 'C', r.file)
    await expect(readFile(jobFor('C', 'renamed.md'))).rejects.toThrow('ENOENT')
  })

  it('run now assigns to ai, clears runAt and writes a trigger', async () => {
    const b = await createBoard(ws, { name: 'B' })
    const c0 = await createCard(ws, b.path, { title: 't', runAt: '2099-01-01T09:00' })
    const c = await runCardNow(ws, b.path, c0.file)
    expect(c).toMatchObject({ assignee: 'ai', ai: { state: 'scheduled' } })
    expect(c.runAt).toBeUndefined()
    expect(await readdir(path.join(ws, TRIGGER_DIR))).toEqual([cardJobName('B/t.md')])
  })

  it('cardExists sees deleted and un-boarded cards', async () => {
    const b = await createBoard(ws, { name: 'B' })
    await createCard(ws, b.path, { title: 't' })
    expect(await cardExists(ws, 'B/t.md')).toBe(true)
    expect(await cardExists(ws, 'B/gone.md')).toBe(false)
    await deleteBoard(ws, b.path)
    expect(await cardExists(ws, 'B/t.md')).toBe(false)
  })
})

describe('cardAfterRun', () => {
  const run = { ts: '2026-09-26T10:00:00Z', sessionId: 's1', summary: 'Done: reports/x.md' }

  it('moves through doing → review on success', () => {
    const started = cardAfterRun(card(), DEFAULT_COLUMNS, { type: 'started', sessionId: 's1' })
    expect(started).toMatchObject({ status: 'doing', ai: { state: 'running', sessionId: 's1' } })
    const done = cardAfterRun(started, DEFAULT_COLUMNS, { type: 'finished', run: { ...run, status: 'ok' } })
    expect(done).toMatchObject({ status: 'review', ai: { state: 'done', summary: 'Done: reports/x.md' } })
  })

  it('goes back to todo on failure or timeout, ignores skipped', () => {
    for (const status of ['failed', 'timeout'] as const) {
      const c = cardAfterRun(card({ status: 'doing' }), DEFAULT_COLUMNS, { type: 'finished', run: { ...run, status } })
      expect(c).toMatchObject({ status: 'todo', ai: { state: 'failed' } })
    }
    const c = card({ status: 'doing' })
    expect(cardAfterRun(c, DEFAULT_COLUMNS, { type: 'finished', run: { ...run, status: 'skipped' } })).toBe(c)
  })

  it('stays put when the target column was removed', () => {
    const cols = DEFAULT_COLUMNS.filter((c) => c.id !== 'review')
    const c = cardAfterRun(card({ status: 'doing' }), cols, { type: 'finished', run: { ...run, status: 'ok' } })
    expect(c.status).toBe('doing')
  })

  it('applyCardRun writes the card and ignores deleted cards', async () => {
    const b = await createBoard(ws, { name: 'B' })
    const c = await createCard(ws, b.path, { title: 't' })
    await applyCardRun(ws, cardRef(b.path, c.file), { type: 'started', sessionId: 's9' })
    expect((await readCard(ws, b.path, c.file)).status).toBe('doing')
    expect(await applyCardRun(ws, 'B/gone.md', { type: 'started', sessionId: 's9' })).toBeNull()
  })
})

describe('people', () => {
  it('always has me and ai, which cannot be deleted', async () => {
    expect((await listPeople(ws)).map((p) => p.id)).toEqual(['me', 'ai'])
    await expect(deletePerson('ai', ws)).rejects.toThrow(/built in/)
  })

  it('creates, renames and deletes people', async () => {
    const a = await createPerson({ name: 'Alice Martin' }, ws)
    const a2 = await createPerson({ name: 'Alice Martin' }, ws)
    expect([a.id, a2.id]).toEqual(['alice-martin', 'alice-martin-2'])
    await updatePerson(a.id, { name: 'Alice M.' }, ws)
    await updatePerson('me', { name: 'Levende' }, ws)
    const people = await listPeople(ws)
    expect(people.map((p) => p.name)).toEqual(['Levende', 'AI', 'Alice M.', 'Alice Martin'])
    await deletePerson(a2.id, ws)
    expect(await listPeople(ws)).toHaveLength(3)
  })
})
