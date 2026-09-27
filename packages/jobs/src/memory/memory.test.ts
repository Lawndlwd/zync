import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { createPerson, deletePerson, readPersonNotes, writePersonNotes } from '../people/index.js'
import {
  buildMemoryPrompt,
  createMemory,
  globalMemoryDir,
  listMemories,
  parseMemory,
  saveMemory,
  searchMemory,
  serializeMemory,
  updateMemory,
  workspaceMemoryDir,
} from './index.js'

let root: string
let ws: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'memory-'))
  ws = path.join(root, 'alpha')
  await mkdir(ws)
})

describe('memory files', () => {
  it('round-trips frontmatter and keeps unknown keys', () => {
    const m = parseMemory('Commits.md', '---\ntype: rule\npinned: true\nsource: me\n---\nUse gitmoji.\n', 'global', 't')
    expect(m).toMatchObject({
      title: 'Commits',
      type: 'rule',
      pinned: true,
      body: 'Use gitmoji.',
      extra: { source: 'me' },
    })
    expect(serializeMemory(m)).toBe('---\ntype: rule\npinned: true\nsource: me\n---\n\nUse gitmoji.\n')
  })

  it('writes a plain body when there is no frontmatter', () => {
    expect(serializeMemory({ pinned: false, body: 'Just text', extra: {} })).toBe('Just text\n')
  })

  it('creates, lists (pinned first), renames and saves by title', async () => {
    const dir = globalMemoryDir(root)
    await createMemory(dir, 'global', { title: 'Tone', body: 'Terse.', type: 'preference' })
    await createMemory(dir, 'global', { title: 'Commits', body: 'Gitmoji.', pinned: true })
    await expect(createMemory(dir, 'global', { title: 'Tone' })).rejects.toMatchObject({ status: 409 })
    expect((await listMemories(dir, 'global')).map((m) => m.title)).toEqual(['Commits', 'Tone'])

    const renamed = await updateMemory(dir, 'global', 'Tone.md', { title: 'Answer tone', description: 'How to answer' })
    expect(renamed).toMatchObject({ file: 'Answer tone.md', description: 'How to answer', body: 'Terse.' })

    const saved = await saveMemory(dir, 'global', { title: 'Answer tone', body: 'Terse, French.' })
    expect(saved.created).toBe(false)
    expect(saved.memory).toMatchObject({ body: 'Terse, French.', type: 'preference', description: 'How to answer' })
    expect((await saveMemory(dir, 'global', { title: 'a/b: c' })).memory.file).toBe('a-b- c.md')
  })

  it('rejects paths outside the folder', async () => {
    await expect(updateMemory(globalMemoryDir(root), 'global', '../x.md', {})).rejects.toMatchObject({ status: 404 })
  })
})

describe('people notes', () => {
  it('reads, writes, clears, and is removed with the person', async () => {
    const p = await createPerson({ name: 'Sofia' }, root)
    await writePersonNotes(p.id, 'Designer.\n', root)
    expect(await readPersonNotes(p.id, root)).toBe('Designer.')
    await expect(writePersonNotes('nobody', 'x', root)).rejects.toMatchObject({ status: 404 })
    await deletePerson(p.id, root)
    expect(await readPersonNotes(p.id, root)).toBe('')
    await writePersonNotes('me', 'Dev in Paris', root)
    await writePersonNotes('me', '  ', root)
    await expect(readFile(path.join(root, '.zync/people/me.md'))).rejects.toThrow('ENOENT')
  })
})

describe('prompt', () => {
  it('has people notes, pinned memories in full and an index of the rest', async () => {
    await writePersonNotes('me', 'Levende, dev in Paris.', root)
    const sofia = await createPerson({ name: 'Sofia' }, root)
    await writePersonNotes(sofia.id, 'Designer.', root)
    await createMemory(globalMemoryDir(root), 'global', {
      title: 'Commits',
      body: 'Gitmoji.',
      pinned: true,
      type: 'rule',
    })
    await createMemory(workspaceMemoryDir(ws), 'workspace', {
      title: 'Deploy',
      body: 'Dokploy.',
      description: 'Where it runs',
    })
    await writeFile(path.join(root, 'beta.md'), '')

    const text = await buildMemoryPrompt({ root, wsPath: ws })
    expect(text).toContain('## About the user (@me, Me)\nLevende, dev in Paris.')
    expect(text).toContain('### Sofia (@sofia)\nDesigner.')
    expect(text).toContain('### Commits [global · rule]\nGitmoji.')
    expect(text).toContain('- Deploy [workspace] — Where it runs')
    expect(text).not.toContain('Dokploy.')
    expect(text).toContain('only the "alpha" workspace')

    // Outside a workspace only global memory counts.
    expect(await buildMemoryPrompt({ root })).not.toContain('Deploy')
  })

  it('says so when memory is empty', async () => {
    expect(await buildMemoryPrompt({ root })).toContain('Memory is empty so far')
  })

  it('searches memories and notes', async () => {
    await writePersonNotes('me', 'Loves espresso.', root)
    await createMemory(globalMemoryDir(root), 'global', { title: 'Coffee order', body: 'Double espresso, no sugar.' })
    const hits = await searchMemory('espresso', { root })
    expect(hits.map((h) => h.title)).toEqual(['Coffee order', 'Me (@me)'])
    expect(await searchMemory('   ', { root })).toEqual([])
  })
})
