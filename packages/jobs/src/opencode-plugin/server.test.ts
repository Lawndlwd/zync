import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

import { memoryTools, systemBlocks, workspaceOf } from './server.js'

let root: string
let ws: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'plugin-'))
  ws = path.join(root, 'alpha')
  await mkdir(ws)
})

const toolsOf = (dir: string) => new Map(memoryTools(dir, root).map((t) => [t.name, t]))

describe('zync opencode plugin', () => {
  it('maps a folder to its workspace', () => {
    expect(workspaceOf(path.join(ws, 'Notes'), root)).toBe(ws)
    expect(workspaceOf(root, root)).toBeUndefined()
    expect(workspaceOf(path.join(root, '.hidden'), root)).toBeUndefined()
    expect(workspaceOf('/elsewhere', root)).toBeUndefined()
  })

  it('offers the memory and people tools with JSON schemas', () => {
    const tools = toolsOf(ws)
    expect([...tools.keys()]).toEqual([
      'memory_save',
      'memory_read',
      'memory_search',
      'memory_delete',
      'person_read',
      'person_note',
    ])
    expect(tools.get('memory_save')?.input).toMatchObject({
      type: 'object',
      required: expect.arrayContaining(['title', 'content', 'description', 'type', 'scope']),
    })
  })

  it('saves, finds and reads a memory, and puts it in the system blocks', async () => {
    const tools = toolsOf(ws)
    const saved = await tools.get('memory_save')?.execute({
      title: 'Commit style',
      content: 'Short subjects.',
      description: 'How to write commits',
      type: 'rule',
      scope: 'workspace',
    })
    expect(saved?.content).toBe('Saved memory "Commit style" (workspace).')
    expect((await tools.get('memory_read')?.execute({ title: 'Commit style' }))?.content).toContain('Short subjects.')
    expect((await tools.get('memory_search')?.execute({ query: 'subjects' }))?.content).toContain('Commit style')
    const blocks = await systemBlocks({ root, wsPath: ws })
    expect(blocks.join('\n')).toContain('Commit style')
  })

  it('answers bad input and a missing workspace with an error the model can read', async () => {
    expect((await toolsOf(ws).get('memory_save')?.execute({ title: 'x' }))?.content).toMatch(/^Error: /)
    const outside = toolsOf(root)
    const res = await outside.get('memory_delete')?.execute({ title: 'x', scope: 'workspace' })
    expect(res?.content).toBe('Error: No current workspace here: use scope "global".')
  })
})
