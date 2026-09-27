import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { applyOrder, readOrder, renameInOrder, setOrder } from './tree-order.js'

let ws: string
beforeEach(async () => {
  ws = await mkdtemp(path.join(tmpdir(), 'zync-order-'))
})

const entries = (...names: string[]) => names.map((name) => ({ name }))

describe('applyOrder', () => {
  it('puts listed names first in saved order, the rest after as they were', () => {
    expect(applyOrder(entries('a', 'b', 'c', 'd'), ['c', 'a']).map((e) => e.name)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('ignores names that no longer exist', () => {
    expect(applyOrder(entries('a', 'b'), ['gone', 'b']).map((e) => e.name)).toEqual(['b', 'a'])
  })

  it('keeps entries as-is without an order', () => {
    const list = entries('b', 'a')
    expect(applyOrder(list, undefined)).toBe(list)
  })
})

describe('setOrder', () => {
  it('stores unique plain names only and drops empty folders', async () => {
    await setOrder(ws, 'notes', ['b', 'a', 'b', '', 'x/y'])
    expect(await readOrder(ws)).toEqual({ notes: ['b', 'a'] })
    await setOrder(ws, 'notes', [])
    expect(await readOrder(ws)).toEqual({})
  })
})

describe('renameInOrder', () => {
  it('renames in place within a folder', async () => {
    await setOrder(ws, '', ['b', 'a'])
    await renameInOrder(ws, 'a', 'z')
    expect(await readOrder(ws)).toEqual({ '': ['b', 'z'] })
  })

  it('removes a file moved to another folder', async () => {
    await setOrder(ws, 'notes', ['a', 'b'])
    await renameInOrder(ws, 'notes/a', 'archive/a')
    expect(await readOrder(ws)).toEqual({ notes: ['b'] })
  })

  it("moves a folder's own and nested orders along", async () => {
    await setOrder(ws, 'p', ['x'])
    await setOrder(ws, 'p/sub', ['y'])
    await setOrder(ws, 'pp', ['keep'])
    await renameInOrder(ws, 'p', 'q')
    expect(await readOrder(ws)).toEqual({ q: ['x'], 'q/sub': ['y'], pp: ['keep'] })
  })

  it('treats a corrupt order file as empty', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises')
    await mkdir(path.join(ws, '.zync'), { recursive: true })
    await writeFile(path.join(ws, '.zync/order.json'), '{nope')
    expect(await readOrder(ws)).toEqual({})
  })
})
