import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError } from './api'
import { basename, dirname, joinPath } from './helpers/paths'

describe('path helpers', () => {
  it('dirname / basename / joinPath on workspace paths', () => {
    expect(dirname('a/b/c.md')).toBe('a/b')
    expect(dirname('c.md')).toBe('')
    expect(basename('a/b/c.md')).toBe('c.md')
    expect(joinPath('', 'c.md')).toBe('c.md')
    expect(joinPath('a', 'c.md')).toBe('a/c.md')
  })
})

describe('request errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throw ApiError with the status, the server message and the body', async () => {
    const body = { error: 'Changed on disk', mtime: 42 }
    vi.stubGlobal('fetch', async () => Response.json(body, { status: 409, statusText: 'Conflict' }))
    const err: unknown = await api.save('w', 'a.md', 'x').catch((caught: unknown) => caught)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 409, message: 'Changed on disk', body })
  })

  it('fall back to the status line without a JSON error', async () => {
    vi.stubGlobal('fetch', async () => new Response('oops', { status: 502, statusText: 'Bad Gateway' }))
    await expect(api.config()).rejects.toMatchObject({ status: 502, message: '502 Bad Gateway' })
  })
})
