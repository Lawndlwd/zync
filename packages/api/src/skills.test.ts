import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseFrontmatter } from '@zync/jobs'
import { describe, expect, it } from 'vitest'

// zync's own opencode skills must have valid YAML frontmatter, or opencode (and the OpenCode page)
// can't read them. A plain value containing ": " is the usual trap: quote it.

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../opencode/skills')

describe('built-in skills', () => {
  it('have a parseable name and description', async () => {
    const names = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) {
      const { data } = parseFrontmatter(await readFile(path.join(dir, name, 'SKILL.md'), 'utf8'))
      expect(data.name).toBe(name)
      expect(typeof data.description).toBe('string')
    }
  })
})
