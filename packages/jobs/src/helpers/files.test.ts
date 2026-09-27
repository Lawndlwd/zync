import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { checkMdFile, exists, freeFileName, listMdFiles, readJson, writeJson } from './files.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'zync-files-'))
})

describe('checkMdFile', () => {
  it('accepts a markdown file name', () => {
    expect(checkMdFile('Note.md', 'card')).toBe('Note.md')
  })

  it.each(['../x.md', 'a/b.md', 'a\\b.md', '.hidden.md', 'note.txt'])('rejects %s as not found', (file) => {
    expect(() => checkMdFile(file, 'card')).toThrow(`Unknown card "${file}"`)
  })
})

describe('listMdFiles', () => {
  it('lists visible markdown files only', async () => {
    await writeFile(path.join(dir, 'a.md'), '')
    await writeFile(path.join(dir, '.b.md'), '')
    await writeFile(path.join(dir, 'c.txt'), '')
    await mkdir(path.join(dir, 'd.md'))
    expect(await listMdFiles(dir)).toEqual(['a.md'])
  })

  it('is empty for a missing folder', async () => {
    expect(await listMdFiles(path.join(dir, 'nope'))).toEqual([])
  })
})

describe('freeFileName', () => {
  it('numbers the name when it is taken', async () => {
    await writeFile(path.join(dir, 'Plan.md'), '')
    expect(await freeFileName(dir, 'Plan')).toBe('Plan 2.md')
  })

  it("keeps the file's own name", async () => {
    await writeFile(path.join(dir, 'Plan.md'), '')
    expect(await freeFileName(dir, 'Plan', 'Plan.md')).toBe('Plan.md')
  })
})

describe('readJson / writeJson', () => {
  it('round-trips pretty JSON with a trailing newline', async () => {
    const file = path.join(dir, 'x.json')
    await writeJson(file, { a: 1 })
    expect(await readFile(file, 'utf8')).toBe('{\n  "a": 1\n}\n')
    expect(await readJson(file)).toEqual({ a: 1 })
  })

  it('rejects malformed JSON', async () => {
    const file = path.join(dir, 'bad.json')
    await writeFile(file, '{')
    await expect(readJson(file)).rejects.toBeInstanceOf(SyntaxError)
  })
})

describe('exists', () => {
  it('tells whether a path exists', async () => {
    expect(await exists(dir)).toBe(true)
    expect(await exists(path.join(dir, 'nope'))).toBe(false)
  })
})
