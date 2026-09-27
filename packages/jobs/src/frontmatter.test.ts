import { describe, expect, it } from 'vitest'

import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.js'

describe('stringifyFrontmatter', () => {
  it('writes the body after a blank line', () => {
    expect(stringifyFrontmatter({ a: 1 }, 'Body')).toBe('---\na: 1\n---\n\nBody\n')
  })

  it('writes only the frontmatter for an empty body', () => {
    expect(stringifyFrontmatter({ a: 1 }, '')).toBe('---\na: 1\n---\n\n')
  })

  it('round-trips through parseFrontmatter', () => {
    const { data, content } = parseFrontmatter(stringifyFrontmatter({ tags: ['x'] }, 'Hi'))
    expect(data).toEqual({ tags: ['x'] })
    expect(content.trim()).toBe('Hi')
  })
})
