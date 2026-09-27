import { describe, expect, it } from 'vitest'

import { sessionFromPath } from './chatSession'

describe('sessionFromPath', () => {
  it('finds the session id in an opencode address', () => {
    expect(sessionFromPath('/L3dvcmtzcGFjZXM/session/ses_abc123')).toBe('ses_abc123')
  })

  it('returns null without a session', () => {
    expect(sessionFromPath('/L3dvcmtzcGFjZXM')).toBeNull()
    expect(sessionFromPath('/x/session/other')).toBeNull()
  })
})
