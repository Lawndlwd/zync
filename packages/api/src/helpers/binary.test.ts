import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { isBinaryFile } from './binary.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'zync-binary-'))
})

describe('isBinaryFile', () => {
  it('says text is not binary', async () => {
    const file = path.join(dir, 'a.md')
    await writeFile(file, '# Hello\n')
    expect(await isBinaryFile(file, 8192)).toBe(false)
  })

  it('finds a NUL byte', async () => {
    const file = path.join(dir, 'a.bin')
    await writeFile(file, Buffer.from([65, 0, 66]))
    expect(await isBinaryFile(file, 8192)).toBe(true)
  })

  it('only looks at the first bytes', async () => {
    const file = path.join(dir, 'late.bin')
    await writeFile(file, Buffer.concat([Buffer.alloc(10, 65), Buffer.from([0])]))
    expect(await isBinaryFile(file, 10)).toBe(false)
  })

  it('treats an empty file as text', async () => {
    const file = path.join(dir, 'empty')
    await writeFile(file, '')
    expect(await isBinaryFile(file, 8192)).toBe(false)
  })
})
