import { describe, expect, it } from 'vitest'

import { isAppPath } from './spa.js'

describe('isAppPath', () => {
  it.each(['/', '/?x=1', '/login', '/zync/api/health', '/w', '/w/notes/files'])('keeps %s in the app', (url) => {
    expect(isAppPath(url)).toBe(true)
  })

  it.each(['/session', '/assets/app.js', '/wiki'])('leaves %s to opencode', (url) => {
    expect(isAppPath(url)).toBe(false)
  })
})
