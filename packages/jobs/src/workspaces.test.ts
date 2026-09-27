import { describe, expect, it } from 'vitest'

import { isValidWorkspaceName } from './workspaces.js'

describe('isValidWorkspaceName', () => {
  it('accepts plain folder names', () => {
    expect(isValidWorkspaceName('personal')).toBe(true)
  })

  it('rejects traversal and hidden names', () => {
    expect(isValidWorkspaceName('..')).toBe(false)
    expect(isValidWorkspaceName('a/../b')).toBe(false)
    expect(isValidWorkspaceName('.hidden')).toBe(false)
  })
})
