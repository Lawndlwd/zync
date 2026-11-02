import { describe, expect, it } from 'vitest'

import { sessionFromPath } from './chatSession'

describe('sessionFromPath', () => {
  it('finds the session id in a v2 opencode address', () => {
    expect(sessionFromPath('/server/aHR0cHM6Ly9leGFtcGxlLmNvbQ/session/ses_abc123')).toBe('ses_abc123')
  })

  it('returns null without a session', () => {
    expect(sessionFromPath('/server/aHR0cHM6Ly9leGFtcGxlLmNvbQ')).toBeNull()
    expect(sessionFromPath('/x/session/other')).toBeNull()
  })
})
