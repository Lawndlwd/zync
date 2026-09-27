import { describe, expect, it } from 'vitest'

import { boardUrl, chatUrlFor, fileUrl, folderUrl, libraryUrl, sessionUrl, wsUrl } from './urls'

describe('app urls', () => {
  it('builds workspace urls with encoded segments', () => {
    expect(wsUrl('my ws')).toBe('/w/my%20ws')
    expect(wsUrl('w', 'jobs')).toBe('/w/w/jobs')
    expect(fileUrl('w', 'a b/c.md')).toBe('/w/w/files/a%20b/c.md')
    expect(boardUrl('w', 'projects/Sprint 1')).toBe('/w/w/boards/projects/Sprint%201')
    expect(folderUrl('w', '')).toBe('/w/w/files')
    expect(folderUrl('w', 'a/b')).toBe('/w/w/files?dir=a%2Fb')
    expect(libraryUrl('w')).toBe('/w/w/opencode')
    expect(libraryUrl('w', 'skills/x/SKILL.md')).toBe('/w/w/opencode/skills/x/SKILL.md')
    expect(sessionUrl('w', 'ses 1')).toBe('/w/w/chat?session=ses%201')
  })

  it('addresses a chat directory as base64url', () => {
    expect(chatUrlFor('/data/w')).toBe('/L2RhdGEvdw')
    expect(chatUrlFor('/data/w', 'ses_1')).toBe('/L2RhdGEvdw/session/ses_1')
  })
})
